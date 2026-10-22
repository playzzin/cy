using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace CyPhotoClipboard {
    // Deliberately small HTTP subset: one bounded, length-delimited request per connection.
    // No URL downloads, path arguments, arbitrary file reads, cookies, shell commands or logs.
    public sealed class Bridge : IDisposable {
        public const int Port = 43127;
        public const string Origin = "https://cyee-9c1e4.web.app";
        const long MaxTotal = 200L * 1024 * 1024;
        const int MaxFile = 20 * 1024 * 1024;
        readonly TcpListener listener;
        readonly string root;
        readonly Action<string[]> clipboard;
        readonly Func<string, string[], CancellationToken, PhotoWindowResult> photoWindow;
        readonly CancellationTokenSource shutdown = new CancellationTokenSource();
        readonly object sync = new object();
        readonly Dictionary<string, DateTime> sessions = new Dictionary<string, DateTime>();
        readonly Dictionary<string, Batch> batches = new Dictionary<string, Batch>();
        readonly Semaphore slots = new Semaphore(4, 4);
        volatile bool stopped;
        int saving;
        public Batch LastBatch { get; private set; }
        public sealed class Batch {
            public string batchId;
            public string folderName;
            public int savedCount;
            internal string[] paths;
            internal string token;
            internal DateTime expires;
        }
        public sealed class Manifest { public Photo[] files { get; set; } }
        public sealed class Photo { public string name { get; set; } public string type { get; set; } public long size { get; set; } }
        sealed class CopyRequest { public string batchId { get; set; } }
        sealed class BadRequest : Exception { public int Status; public string Code; public BadRequest(int status, string code = "request-failed") { Status = status; Code = code; } }
        sealed class Request {
            public string Method, Path;
            public long Length;
            public Dictionary<string, string> Headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            public string Header(string key) { string value; return Headers.TryGetValue(key, out value) ? value : ""; }
        }
        static JavaScriptSerializer Json() { return new JavaScriptSerializer { MaxJsonLength = 65536, RecursionLimit = 8 }; }
        public Bridge(string saveRoot, Action<string[]> copy, int port) : this(saveRoot, copy, port, null) { }
        public Bridge(string saveRoot, Action<string[]> copy, int port, Func<string, string[], CancellationToken, PhotoWindowResult> openPhotoWindow) {
            root = Path.GetFullPath(saveRoot); clipboard = copy;
            photoWindow = openPhotoWindow;
            listener = new TcpListener(IPAddress.Loopback, port);
            listener.Server.ExclusiveAddressUse = true;
        }
        public void Start() {
            listener.Start(4);
            var thread = new Thread(Accept) { IsBackground = true }; thread.Start();
        }
        void Accept() {
            while (!stopped) {
                try {
                    var client = listener.AcceptTcpClient();
                    if (!slots.WaitOne(0)) { client.Close(); continue; }
                    ThreadPool.QueueUserWorkItem(delegate { try { Handle(client); } finally { client.Close(); slots.Release(); } });
                } catch (SocketException) { if (!stopped) Thread.Sleep(100); }
                  catch (ObjectDisposedException) { return; }
            }
        }
        public void Dispose() { stopped = true; shutdown.Cancel(); listener.Stop(); }
        static byte[] Read(Stream input, int count) {
            var bytes = new byte[count]; int offset = 0;
            while (offset < count) { int n = input.Read(bytes, offset, count - offset); if (n == 0) throw new EndOfStreamException(); offset += n; }
            return bytes;
        }
        static Request Parse(Stream input) {
            var buffer = new List<byte>();
            while (buffer.Count < 16384) {
                int value = input.ReadByte(); if (value < 0) throw new BadRequest(400);
                if (value > 127 || (value < 32 && value != 13 && value != 10 && value != 9)) throw new BadRequest(400);
                buffer.Add((byte)value);
                int n = buffer.Count;
                if (n >= 4 && buffer[n-4] == 13 && buffer[n-3] == 10 && buffer[n-2] == 13 && buffer[n-1] == 10) break;
            }
            if (buffer.Count >= 16384) throw new BadRequest(431);
            var lines = Encoding.ASCII.GetString(buffer.ToArray()).Split(new[] { "\r\n" }, StringSplitOptions.None);
            var first = lines[0].Split(' ');
            if (first.Length != 3 || first[2] != "HTTP/1.1") throw new BadRequest(400);
            var request = new Request { Method = first[0], Path = first[1] };
            for (int i = 1; i < lines.Length - 2; i++) {
                int colon = lines[i].IndexOf(':');
                if (colon <= 0 || char.IsWhiteSpace(lines[i][0])) throw new BadRequest(400);
                var key = lines[i].Substring(0, colon);
                if (key.Any(c => !char.IsLetterOrDigit(c) && c != '-')) throw new BadRequest(400);
                if (request.Headers.ContainsKey(key)) throw new BadRequest(400);
                request.Headers.Add(key, lines[i].Substring(colon + 1).Trim());
            }
            if (request.Header("Transfer-Encoding") != "" || request.Header("Expect") != "" || request.Header("Content-Encoding") != "") throw new BadRequest(400);
            if (request.Header("Content-Length") != "" && (!long.TryParse(request.Header("Content-Length"), out request.Length) || request.Length < 0)) throw new BadRequest(400);
            if (request.Length > MaxTotal + 65540) throw new BadRequest(413);
            return request;
        }
        static string RandomToken() {
            var bytes = new byte[32]; using (var random = RandomNumberGenerator.Create()) random.GetBytes(bytes);
            return BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant();
        }
        string Session() {
            lock (sync) {
                foreach (var token in sessions.Where(pair => pair.Value < DateTime.UtcNow).Select(pair => pair.Key).ToArray()) sessions.Remove(token);
                if (sessions.Count >= 32) throw new BadRequest(429);
                var result = RandomToken(); sessions.Add(result, DateTime.UtcNow.AddMinutes(5)); return result;
            }
        }
        string Authorize(Request request) {
            var header = request.Header("Authorization");
            if (!header.StartsWith("Bearer ", StringComparison.Ordinal)) throw new BadRequest(403);
            var token = header.Substring(7);
            lock (sync) { DateTime expires; if (!sessions.TryGetValue(token, out expires) || expires < DateTime.UtcNow) throw new BadRequest(403); }
            return token;
        }
        void Handle(TcpClient client) {
            bool cors = false;
            using (var stream = client.GetStream()) {
                client.ReceiveTimeout = 5000; client.SendTimeout = 5000;
                // A peer cannot keep a slot forever by trickling header/body bytes.
                using (var cancellation = CancellationTokenSource.CreateLinkedTokenSource(shutdown.Token))
                using (var deadline = new Timer(delegate { try { cancellation.Cancel(); client.Close(); } catch (ObjectDisposedException) { } }, null, 130000, Timeout.Infinite)) {
                    try {
                        var request = Parse(stream);
                        if (request.Header("Host") != "127.0.0.1:" + ((IPEndPoint)listener.LocalEndpoint).Port || request.Header("Origin") != Origin) throw new BadRequest(403);
                        cors = true;
                        if (request.Path != "/v1/session" && request.Path != "/v1/prepare" && request.Path != "/v1/copy" && request.Path != "/v1/open-photo-window") throw new BadRequest(404);
                        if (request.Method == "OPTIONS") {
                            var method = request.Header("Access-Control-Request-Method");
                            if (request.Length != 0 || (method != "GET" && method != "POST")) throw new BadRequest(400);
                            var allowed = new[] { "x-cy-photo-protocol", "content-type", "authorization" };
                            if (request.Header("Access-Control-Request-Headers").Split(',').Any(h => !allowed.Contains(h.Trim().ToLowerInvariant()))) throw new BadRequest(403);
                            Reply(stream, 204, null, true); return;
                        }
                        if (request.Header("X-CY-Photo-Protocol") != "2" && !(request.Path == "/v1/session" && request.Header("X-CY-Photo-Protocol") == "1")) throw new BadRequest(403, "version");
                        if (request.Method == "GET" && request.Path == "/v1/session" && request.Length == 0) {
                            Reply(stream, 200, new { app = "cy-photo-clipboard", protocol = 2, version = "1.3.0", clipboardMode = "shell-files-v1", photoWindowMode = "shell-view-v1", token = Session() }, true); return;
                        }
                        if (request.Method != "POST") throw new BadRequest(405);
                        var token = Authorize(request);
                        if (Interlocked.CompareExchange(ref saving, 1, 0) != 0) { Reply(stream, 409, new { error = "busy" }, true); return; }
                        try {
                            client.ReceiveTimeout = 15000;
                            if (request.Path == "/v1/prepare" && request.Header("Content-Type") == "application/octet-stream") {
                                var batch = Save(stream, request.Length, token);
                                Reply(stream, 200, new { batch.batchId, photoCount = batch.savedCount }, true);
                            } else if ((request.Path == "/v1/copy" || request.Path == "/v1/open-photo-window") && request.Header("Content-Type") == "application/json" && request.Length > 0 && request.Length <= 256) {
                                var data = Json().Deserialize<CopyRequest>(Encoding.UTF8.GetString(Read(stream, (int)request.Length)));
                                Batch batch;
                                lock (sync) {
                                    if (data == null || data.batchId == null || !batches.TryGetValue(data.batchId, out batch) || batch.token != token || batch.expires < DateTime.UtcNow) throw new BadRequest(404);
                                }
                                if (request.Path == "/v1/copy") {
                                    bool copied = TryCopy(batch);
                                    Reply(stream, 200, new { batch.batchId, photoCount = batch.savedCount, copied }, true);
                                } else {
                                    PhotoWindowResult opened;
                                    // The complete request body has been consumed. A readable
                                    // socket with no buffered bytes now means the browser ended
                                    // this request while the native view was still preparing.
                                    // Stop watching as soon as the callback completes: an already
                                    // opened photo window has its own user-controlled lifetime.
                                    var pendingSync = new object();
                                    bool pending = true;
                                    CancelDisconnectedRequest(client, cancellation);
                                    using (var disconnected = new Timer(delegate {
                                        lock (pendingSync) { if (pending) CancelDisconnectedRequest(client, cancellation); }
                                    }, null, 100, 100)) {
                                        try { opened = photoWindow == null ? PhotoWindowResult.Failed : photoWindow(batch.batchId, (string[])batch.paths.Clone(), cancellation.Token); }
                                        catch { opened = PhotoWindowResult.Failed; }
                                        finally { lock (pendingSync) { pending = false; } }
                                    }
                                    if (opened == PhotoWindowResult.Busy) throw new BadRequest(409, "photo-window-busy");
                                    if (opened != PhotoWindowResult.Opened) throw new BadRequest(500, "photo-window");
                                    Reply(stream, 200, new { batch.batchId, photoCount = batch.savedCount, opened = true }, true);
                                }
                            } else throw new BadRequest(400);
                        } finally { Interlocked.Exchange(ref saving, 0); }
                    } catch (BadRequest error) { SafeError(stream, error.Status, cors, error.Code); }
                      catch (UnauthorizedAccessException) { SafeError(stream, 500, cors, "temporary-files"); }
                      catch (IOException) { SafeError(stream, 500, cors, "temporary-files"); }
                      catch { SafeError(stream, 500, cors); }
                    finally {
                        // Half-close before discarding a rejected body. An immediate close with unread
                        // bytes causes Windows TCP to reset the connection and lose the error response.
                        try {
                            client.Client.Shutdown(SocketShutdown.Send); client.ReceiveTimeout = 250;
                            var discard = new byte[4096];
                            for (int left = 65536; left > 0;) { int n = stream.Read(discard, 0, Math.Min(left, discard.Length)); if (n == 0) break; left -= n; }
                        } catch { }
                    }
                }
            }
        }
        static void CancelDisconnectedRequest(TcpClient client, CancellationTokenSource cancellation) {
            bool disconnected;
            try { var socket = client.Client; disconnected = socket == null || (socket.Poll(0, SelectMode.SelectRead) && socket.Available == 0); }
            catch (SocketException) { disconnected = true; }
            catch (ObjectDisposedException) { disconnected = true; }
            if (disconnected) { try { cancellation.Cancel(); } catch (ObjectDisposedException) { } }
        }
        public bool CopyLast() { return LastBatch != null && TryCopy(LastBatch); }
        bool TryCopy(Batch batch) {
            if (batch.paths.Any(p => !File.Exists(p))) return false;
            try { clipboard(batch.paths); return true; } catch { return false; }
        }
        Batch Save(Stream input, long length, string token) {
            if (length < 4) throw new BadRequest(400);
            int manifestLength = BitConverter.ToInt32(Read(input, 4), 0);
            if (manifestLength <= 0 || manifestLength > 65536 || length < manifestLength + 4) throw new BadRequest(400);
            Manifest manifest;
            try { manifest = Json().Deserialize<Manifest>(new UTF8Encoding(false, true).GetString(Read(input, manifestLength))); }
            catch { throw new BadRequest(400); }
            if (manifest == null || manifest.files == null || manifest.files.Length == 0 || manifest.files.Length > 100) throw new BadRequest(400);
            if (manifest.files.Any(f => f == null || f.size < 12 || f.size > MaxFile || string.IsNullOrEmpty(f.name) || f.name.Length > 255)) throw new BadRequest(400);
            long total = manifest.files.Sum(f => f.size);
            if (total > MaxTotal || total + manifestLength + 4 != length) throw new BadRequest(400);
            var names = manifest.files.Select((photo, index) => SafeName(photo, index)).ToArray();
            var id = Guid.NewGuid().ToString("N");
            var folderName = "신분증_사진_" + DateTime.Now.ToString("yyyyMMdd_HHmmss") + "_" + id.Substring(0, 8);
            var folder = Path.Combine(root, folderName);
            if (Directory.Exists(folder)) throw new BadRequest(409);
            Directory.CreateDirectory(folder);
            var paths = new List<string>();
            try {
                TemporaryPhotos.Mark(folder);
                for (int index = 0; index < manifest.files.Length; index++) {
                    var photo = manifest.files[index];
                    var prefix = Read(input, 12);
                    if (!ValidSignature(prefix, photo.type)) throw new BadRequest(400, "image-format");
                    var path = Path.Combine(folder, names[index]);
                    using (var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None)) {
                        paths.Add(path); output.Write(prefix, 0, prefix.Length);
                        long remaining = photo.size - prefix.Length;
                        var buffer = new byte[65536];
                        while (remaining > 0) {
                            int count = input.Read(buffer, 0, (int)Math.Min(buffer.Length, remaining));
                            if (count <= 0) throw new EndOfStreamException();
                            output.Write(buffer, 0, count); remaining -= count;
                        }
                    }
                }
                var batch = new Batch { batchId = id, folderName = folderName, savedCount = paths.Count, paths = paths.ToArray(), token = token, expires = DateTime.UtcNow.AddMinutes(5) };
                lock (sync) {
                    foreach (var key in batches.Where(p => p.Value.expires < DateTime.UtcNow).Select(p => p.Key).ToArray()) batches.Remove(key);
                    batches.Add(id, batch); LastBatch = batch;
                }
                return batch;
            } catch {
                // Only files created in this new batch are eligible for rollback, never recursive deletion.
                foreach (var path in paths) { try { File.Delete(path); } catch { } }
                try { File.Delete(Path.Combine(folder, TemporaryPhotos.Marker)); } catch { }
                try { Directory.Delete(folder, false); } catch { }
                throw;
            }
        }
        static string SafeName(Photo photo, int index) {
            string extension;
            switch (photo.type) {
                case "image/jpeg": extension = ".jpg"; break;
                case "image/png": extension = ".png"; break;
                case "image/gif": extension = ".gif"; break;
                case "image/webp": extension = ".webp"; break;
                case "image/bmp": extension = ".bmp"; break;
                default: throw new BadRequest(400);
            }
            // Strip all path syntax, device names and ADS semantics; enforce a numeric prefix.
            var name = new string(photo.name.Select(c => c < 32 || "\\/:*?\"<>|".Contains(c) ? '_' : c).ToArray());
            int dot = name.LastIndexOf('.'); if (dot > 0) name = name.Substring(0, dot);
            if (name.Length > 80) name = name.Substring(0, 80);
            return (index + 1).ToString("D3") + "_" + name.TrimEnd(' ', '.') + extension;
        }
        static bool ValidSignature(byte[] b, string type) {
            switch (type) {
                case "image/jpeg": return b[0] == 255 && b[1] == 216 && b[2] == 255;
                case "image/png": return b.Take(8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
                case "image/gif": return Encoding.ASCII.GetString(b, 0, 6) == "GIF87a" || Encoding.ASCII.GetString(b, 0, 6) == "GIF89a";
                case "image/webp": return Encoding.ASCII.GetString(b, 0, 4) == "RIFF" && Encoding.ASCII.GetString(b, 8, 4) == "WEBP";
                case "image/bmp": return b[0] == 66 && b[1] == 77;
                default: return false;
            }
        }
        static void SafeError(Stream stream, int status, bool cors, string code = "request-failed") { try { Reply(stream, status, new { error = code }, cors); } catch { } }
        static void Reply(Stream stream, int status, object result, bool cors) {
            var bytes = result == null ? new byte[0] : Encoding.UTF8.GetBytes(Json().Serialize(result));
            var headers = "HTTP/1.1 " + status + " Response\r\nConnection: close\r\nContent-Type: application/json; charset=utf-8\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nContent-Length: " + bytes.Length + "\r\n";
            if (cors) headers += "Access-Control-Allow-Origin: " + Origin + "\r\nVary: Origin\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: X-CY-Photo-Protocol, Authorization, Content-Type\r\nAccess-Control-Allow-Private-Network: true\r\n";
            var head = Encoding.ASCII.GetBytes(headers + "\r\n"); stream.Write(head, 0, head.Length); stream.Write(bytes, 0, bytes.Length); stream.Flush();
        }
    }
}
