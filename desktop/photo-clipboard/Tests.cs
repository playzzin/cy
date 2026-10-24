using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Sockets;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Threading;
using System.Threading.Tasks;

namespace CyPhotoClipboard {
    public static class Tests {
        [DllImport("user32.dll")] static extern IntPtr GetClipboardOwner();
        [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] static extern int GetWindowLong(IntPtr window, int index);
        [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr window, uint command);
        static int passed;
        static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
        sealed class Response { public int status; public string raw; public Dictionary<string, object> data; }
        static void Check(bool condition, string label) { if (!condition) throw new Exception(label); passed++; Console.WriteLine("PASS " + label); }
        static Response Send(string path, byte[] body, string token, string origin, string extra, string method) {
            using (var client = new TcpClient("127.0.0.1", 43128)) {
                client.ReceiveTimeout = 20000;
                using (var stream = client.GetStream()) {
                    var header = method + " " + path + " HTTP/1.1\r\nHost: 127.0.0.1:43128\r\n" + (origin == null ? "" : "Origin: " + origin + "\r\n") +
                        "X-CY-Photo-Protocol: 2\r\n" + (token == null ? "" : "Authorization: Bearer " + token + "\r\n") +
                        "Content-Type: " + (path == "/v1/copy" || path == "/v1/open-photo-window" || (path.StartsWith("/v1/prepare/") && path != "/v1/prepare/chunk") ? "application/json" : "application/octet-stream") + "\r\nContent-Length: " + (body == null ? 0 : body.Length) + "\r\n" + extra + "\r\n";
                    var bytes = Encoding.ASCII.GetBytes(header); stream.Write(bytes, 0, bytes.Length);
                    if (body != null) stream.Write(body, 0, body.Length);
                    var head = new StringBuilder();
                    while (!head.ToString().EndsWith("\r\n\r\n", StringComparison.Ordinal)) { int b = stream.ReadByte(); if (b < 0) throw new IOException("missing response"); head.Append((char)b); }
                    int length = int.Parse(head.ToString().Split(new[] { "\r\n" }, StringSplitOptions.None).First(line => line.StartsWith("Content-Length:")).Substring(15));
                    var content = new byte[length]; int offset = 0;
                    while (offset < length) { int n = stream.Read(content, offset, length - offset); if (n == 0) throw new IOException("truncated response"); offset += n; }
                    var json = Encoding.UTF8.GetString(content);
                    return new Response { status = int.Parse(head.ToString().Split(' ')[1]), raw = head + json,
                        data = json.Length > 0 ? Json.Deserialize<Dictionary<string, object>>(json) : null };
                }
            }
        }
        static Response Call(string path, byte[] body = null, string token = null) { return Send(path, body, token, Bridge.Origin, "", body == null ? "GET" : "POST"); }
        static byte[] Pack(string[] names, byte[][] bytes, string[] types) {
            var files = names.Select((name, index) => new { name, type = types[index], size = bytes[index].Length }).ToArray();
            var manifest = Encoding.UTF8.GetBytes(Json.Serialize(new { files }));
            return BitConverter.GetBytes(manifest.Length).Concat(manifest).Concat(bytes.SelectMany(b => b)).ToArray();
        }
        [STAThread] public static int Main(string[] args) {
            try { Run(args); return 0; }
            catch (Exception error) { Console.Error.WriteLine(error.GetType().FullName + ": " + error.Message); return 1; }
            finally { NativeClipboard.Shutdown(); }
        }
        static void Run(string[] args) {
            if (args.Length == 3 && args[0] == "--serve-photo-window") {
                var root = Path.GetFullPath(args[1]); Directory.CreateDirectory(root);
                using (var dispatcher = new Control())
                using (var windows = new ShellPhotoWindows(dispatcher, root))
                using (var server = new Bridge(root, delegate { throw new InvalidOperationException("copy-disabled-in-window-fixture"); }, int.Parse(args[2]), windows.Open))
                using (var stop = new System.Windows.Forms.Timer { Interval = 500 }) {
                    stop.Tick += delegate { if (File.Exists(Path.Combine(root, "stop-photo-window-server"))) Application.ExitThread(); };
                    server.Start(); stop.Start(); Console.WriteLine("photo-window server ready"); Application.Run();
                }
                return;
            }
            if (args.Length == 3 && args[0] == "--test-photo-window") {
                var root = Path.Combine(Path.GetFullPath(args[1]), Guid.NewGuid().ToString("N"));
                var folder = Path.Combine(root, "신분증_사진_20260101_000000_1234abcd"); Directory.CreateDirectory(folder); TemporaryPhotos.Mark(folder);
                var paths = new[] { Path.Combine(folder, "001_test.jpg"), Path.Combine(folder, "002_test.jpg") };
                File.Copy(Path.Combine(args[2], "test-1.jpg"), paths[0]); File.Copy(Path.Combine(args[2], "test-2.jpg"), paths[1]);
                var id = new string('a', 32);
                var nextFolder = Path.Combine(root, "synthetic-next-batch"); Directory.CreateDirectory(nextFolder); TemporaryPhotos.Mark(nextFolder);
                var nextPaths = new[] { Path.Combine(nextFolder, "new-selection.jpg") };
                File.Copy(Path.Combine(args[2], "test-2.jpg"), nextPaths[0]);
                var nextId = new string('b', 32); bool interacting = false;
                using (var dispatcher = new Control()) {
                    using (var windows = new ShellPhotoWindows(dispatcher, root, true, 10000, () => interacting)) {
                        Check(Pump(Task.Run(() => windows.Open(id, paths, CancellationToken.None))) == PhotoWindowResult.Opened, "native Shell view has exact selected file-drop batch");
                        Check(!Application.OpenForms.OfType<ShellPhotoWindow>().Single().TopMost, "hidden diagnostics do not create a topmost window");
                        Check(windows.OpenWindowCount == 1 && windows.UsesFolder(folder), "one native window holds its cache batch");
                        Check(Pump(Task.Run(() => windows.Open(id, paths, CancellationToken.None))) == PhotoWindowResult.Opened && windows.OpenWindowCount == 1, "same batch reuses existing native window");
                        var previous = Application.OpenForms.OfType<ShellPhotoWindow>().Single();
                        interacting = true;
                        Check(Pump(Task.Run(() => windows.Open(nextId, nextPaths, CancellationToken.None))) == PhotoWindowResult.Busy && !previous.IsDisposed, "active drag or held input preserves its source window");
                        interacting = false;
                        using (var cancel = new CancellationTokenSource()) { cancel.Cancel(); Check(windows.Open(nextId, nextPaths, cancel.Token) == PhotoWindowResult.Failed && !previous.IsDisposed, "cancelled replacement leaves the existing view intact"); }
                        Check(Pump(Task.Run(() => windows.Open(nextId, nextPaths, CancellationToken.None))) == PhotoWindowResult.Opened && windows.OpenWindowCount == 1 && previous.IsDisposed, "new batch replaces the idle window without manual closing");
                        var replacement = Application.OpenForms.OfType<ShellPhotoWindow>().Single();
                        Check(replacement.Ready && replacement.Text.Contains("1장"), "replacement selects only the newly requested photo files");
                        Check(windows.UsesFolder(folder) && windows.UsesFolder(nextFolder) && paths.Concat(nextPaths).All(File.Exists), "replacement preserves old and new files for pending recipients");
                        Check(Pump(Task.Run(() => windows.Open(id, paths, CancellationToken.None))) == PhotoWindowResult.Opened && replacement.IsDisposed, "repeated website requests continue to replace one window");
                        Check(Pump(Task.Run(() => windows.Open(id, new[] { Path.Combine(root, "unapproved.jpg") }, CancellationToken.None))) == PhotoWindowResult.Failed, "invalid path rejected before creating a window");
                        using (var cancel = new CancellationTokenSource()) { cancel.Cancel(); Check(windows.Open(id, paths, cancel.Token) == PhotoWindowResult.Failed, "cancelled request cannot open or reactivate a window"); }
                        Directory.SetLastWriteTimeUtc(folder, DateTime.UtcNow.AddHours(-25));
                        TemporaryPhotos.Prune(root, DateTime.UtcNow, windows.UsesFolder);
                        Check(paths.All(File.Exists), "cleanup preserves photos referenced by open Shell window");
                        windows.CloseCurrent();
                        Check(windows.OpenWindowCount == 0 && windows.UsesFolder(folder), "closed window releases view and retains cache grace");
                        Check(Directory.GetLastWriteTimeUtc(folder) > DateTime.UtcNow.AddMinutes(-1), "close refreshes owned batch retention across restart");
                        Check(Pump(Task.Run(() => windows.Open(id, paths, CancellationToken.None))) == PhotoWindowResult.Opened, "closed batch can be opened again");
                        windows.Dispose();
                        Check(windows.OpenWindowCount == 0 && windows.Open(id, paths, CancellationToken.None) == PhotoWindowResult.Failed, "shutdown closes native window and rejects new opens");
                    }
                    using (var shortWait = new ShellPhotoWindows(dispatcher, root, true, 50)) {
                        var timeout = Task.Run(() => shortWait.Open(id, paths, CancellationToken.None));
                        Check(timeout.Wait(2000) && timeout.Result == PhotoWindowResult.Failed, "unresponsive UI dispatch has a bounded timeout");
                        Application.DoEvents();
                        Check(shortWait.OpenWindowCount == 0, "timed-out queued request never opens a stale window");
                    }
                    using (var windows = new ShellPhotoWindows(dispatcher, root, false, 10000, () => false))
                    using (var covering = new Form { Text = "SYNTHETIC NORMAL WINDOW", WindowState = FormWindowState.Maximized }) {
                        covering.Show();
                        Check(Pump(Task.Run(() => windows.Open(id, paths, CancellationToken.None))) == PhotoWindowResult.Opened, "visible photo window prepares the original selection");
                        var photo = Application.OpenForms.OfType<ShellPhotoWindow>().Single();
                        Check((GetWindowLong(photo.Handle, -20) & 8) != 0, "native WS_EX_TOPMOST is set on initial open");
                        covering.Activate(); Application.DoEvents();
                        Check(Above(photo.Handle, covering.Handle), "photo window stays above an activated normal window");
                        var pin = photo.Controls.OfType<CheckBox>().Single(); pin.Checked = false; Application.DoEvents();
                        Check((GetWindowLong(photo.Handle, -20) & 8) == 0, "user can turn off always-on-top");
                        photo.WindowState = FormWindowState.Minimized; Application.DoEvents();
                        Check(Pump(Task.Run(() => windows.Open(id, paths, CancellationToken.None))) == PhotoWindowResult.Opened, "same batch reopens a minimized window");
                        Check(photo.WindowState == FormWindowState.Normal && pin.Checked && (GetWindowLong(photo.Handle, -20) & 8) != 0, "reopen restores and pins the existing window");
                        covering.Activate(); Application.DoEvents();
                        Check(windows.OpenWindowCount == 1 && Above(photo.Handle, covering.Handle), "reopened photo window stays above the normal window without duplicates");
                        photo.WindowState = FormWindowState.Minimized; Application.DoEvents();
                        Check(Pump(Task.Run(() => windows.Open(nextId, nextPaths, CancellationToken.None))) == PhotoWindowResult.Opened && photo.IsDisposed, "new selection replaces even a minimized previous window");
                        var fresh = Application.OpenForms.OfType<ShellPhotoWindow>().Single();
                        Check(fresh.Ready && fresh.WindowState == FormWindowState.Normal && fresh.Text.Contains("1장") && Above(fresh.Handle, covering.Handle), "newly selected photos are visible above the normal window");
                        covering.Close();
                    }
                }
                Console.WriteLine("Passed " + passed + " native photo window checks."); return;
            }
            if (args.Length == 3 && args[0] == "--test-native-clipboard") {
                var files = Directory.GetFiles(args[1]).Where(file => file.EndsWith(".jpg") || file.EndsWith(".png")).OrderBy(file => file).ToArray();
                Check(files.Length == 2, "two synthetic fixture photos");
                NativeClipboard.Copy(files);
                Check(NativeClipboard.Matches(files), "native file list remains available after Copy returns");
                Check(Clipboard.ContainsData("Shell IDList Array"), "Explorer Shell item format is available");
                uint ownerProcess; GetWindowThreadProcessId(GetClipboardOwner(), out ownerProcess);
                Check(ownerProcess == (uint)Process.GetCurrentProcess().Id, "live clipboard owner remains in this process");
                Check(NativeClipboard.UsesFolder(args[1]), "temporary photos remain protected while copied");
                NativeClipboard.Copy(files.Reverse().ToArray());
                Check(NativeClipboard.Matches(files.Reverse().ToArray()), "subsequent copy preserves the exact file set despite Shell ordering");
                bool missingRejected = false;
                try { NativeClipboard.Copy(new[] { Path.Combine(args[1], "missing-synthetic-photo.png") }); } catch (ArgumentException) { missingRejected = true; }
                Check(missingRejected && NativeClipboard.Matches(files.Reverse().ToArray()), "invalid batch does not replace clipboard");
                if (args[2] == "replacement") {
                    Clipboard.SetText("SYNTHETIC CLIPBOARD REPLACEMENT");
                    NativeClipboard.Shutdown();
                    Check(Clipboard.GetText() == "SYNTHETIC CLIPBOARD REPLACEMENT", "shutdown preserves another clipboard owner");
                } else {
                    NativeClipboard.Shutdown();
                    Check(NativeClipboard.Matches(files.Reverse().ToArray()), "shutdown persists copied photos");
                }
                Console.WriteLine("Passed " + passed + " native clipboard checks."); return;
            }
            if ((args.Length == 2 || args.Length == 3) && args[0] == "--serve") {
                using (var server = new Bridge(args[1], NativeClipboard.Copy, args.Length == 3 ? int.Parse(args[2]) : Bridge.Port)) { server.Start(); Console.WriteLine("ready"); Console.ReadLine(); }
                return;
            }
            if (args.Length == 2 && args[0] == "--verify-clipboard") {
                var root = Path.GetFullPath(args[1]) + Path.DirectorySeparatorChar;
                var files = Clipboard.GetFileDropList().Cast<string>().ToArray();
                Check(files.Length == 2 && files.All(file => Path.GetFullPath(file).StartsWith(root, StringComparison.OrdinalIgnoreCase) && File.Exists(file)), "two expected synthetic files in real Windows clipboard");
                Console.WriteLine("Verified Windows FileDrop: 2 existing synthetic photos"); return;
            }
            if (args.Length != 1) throw new ArgumentException("Supply test output folder");
            var directory = Path.Combine(Path.GetFullPath(args[0]), Guid.NewGuid().ToString("N")); Directory.CreateDirectory(directory);
            var jpg = new byte[] { 255, 216, 255, 224, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 };
            var png = new byte[] { 137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3, 4, 5 };
            var pack = Pack(new[] { "테스트.jpg", "../../CON:evil.exe.png" }, new[] { jpg, png }, new[] { "image/jpeg", "image/png" });
            string[] copied = null;
            bool failCopy = false;
            string[] windowPaths = null;
            PhotoWindowResult windowResult = PhotoWindowResult.Opened;
            bool waitForDisconnect = false;
            int lateOpenCommits = 0;
            using (var windowStarted = new ManualResetEventSlim())
            using (var windowCancelled = new ManualResetEventSlim())
            using (var bridge = new Bridge(directory, paths => { if (failCopy) throw new Exception(); copied = paths; }, 43128,
                (id, paths, cancellation) => {
                    windowPaths = paths;
                    if (waitForDisconnect) {
                        windowStarted.Set();
                        if (cancellation.WaitHandle.WaitOne(5000)) { windowCancelled.Set(); return PhotoWindowResult.Failed; }
                        Interlocked.Increment(ref lateOpenCommits);
                    }
                    return windowResult;
                })) {
                bridge.Start();
                var denied = Send("/v1/session", null, null, "https://untrusted.example", "", "GET");
                Check(denied.status == 403 && !denied.raw.Contains("Access-Control-Allow-Origin"), "untrusted origin denied");
                Check(Send("/v1/session", null, null, null, "", "GET").status == 403, "missing origin denied");
                Check(Send("/v1/session", null, null, "null", "", "GET").status == 403, "null origin denied");
                Check(Send("/v1/session", null, null, Bridge.Origin, "Host: attacker.example\r\n", "GET").status == 400, "duplicate host denied");
                Check(Send("/v1/prepare", null, null, Bridge.Origin, "Access-Control-Request-Method: POST\r\nAccess-Control-Request-Headers: authorization,content-type,x-cy-photo-protocol\r\n", "OPTIONS").status == 204, "CORS preflight");
                Check(Send("/v1/prepare", pack, null, Bridge.Origin, "", "POST").status == 403, "missing session denied");
                var session = Call("/v1/session"); var token = (string)session.data["token"];
                Check(session.status == 200 && token.Length == 64, "ephemeral session");
                Check((int)session.data["protocol"] == 2 && (string)session.data["version"] == "1.4.2" && (string)session.data["transferMode"] == "chunks-v1" &&
                    (string)session.data["clipboardMode"] == "shell-files-v1" && (string)session.data["photoWindowMode"] == "shell-view-v1", "advertise compatible copying and native photo window capability");
                Check(Call("/v1/prepare", pack, "wrong").status == 403, "wrong token denied");
                Check(Send("/v1/prepare", pack, token, Bridge.Origin, "Transfer-Encoding: chunked\r\n", "POST").status == 400, "ambiguous framing denied");
                var saved = Call("/v1/prepare", pack, token);
                Check(saved.status == 200 && (int)saved.data["photoCount"] == 2 && copied == null, "save does not copy before commit");
                var batch = (string)saved.data["batchId"];
                var folder = Path.Combine(directory, bridge.LastBatch.folderName);
                var paths = Directory.GetFiles(folder).Where(p => Path.GetFileName(p) != TemporaryPhotos.Marker).OrderBy(p => p).ToArray();
                Check(paths.Length == 2 && paths.All(p => Path.GetDirectoryName(p) == folder), "path traversal confined");
                Check(File.ReadAllBytes(paths[0]).SequenceEqual(jpg) && File.ReadAllBytes(paths[1]).SequenceEqual(png), "original bytes preserved");
                var copyBody = Encoding.UTF8.GetBytes(Json.Serialize(new { batchId = batch }));
                var otherToken = (string)Call("/v1/session").data["token"];
                Check(Call("/v1/open-photo-window", copyBody).status == 403 && windowPaths == null, "photo window requires a session");
                Check(Call("/v1/open-photo-window", copyBody, otherToken).status == 404 && windowPaths == null, "photo window rejects another session batch");
                Check(Call("/v1/open-photo-window", Encoding.UTF8.GetBytes("{\"batchId\":\"C:\\\\secret\"}"), token).status == 404 && windowPaths == null, "photo window does not accept arbitrary paths");
                var opened = Call("/v1/open-photo-window", copyBody, token);
                Check(opened.status == 200 && (bool)opened.data["opened"] && (int)opened.data["photoCount"] == 2 && windowPaths.SequenceEqual(paths) && copied == null, "opening exact prepared batch never copies clipboard");
                windowResult = PhotoWindowResult.Busy;
                var busyWindow = Call("/v1/open-photo-window", copyBody, token);
                Check(busyWindow.status == 409 && (string)busyWindow.data["error"] == "photo-window-busy", "existing photo window busy is explicit");
                windowResult = PhotoWindowResult.Failed;
                var failedWindow = Call("/v1/open-photo-window", copyBody, token);
                Check(failedWindow.status == 500 && (string)failedWindow.data["error"] == "photo-window" && paths.All(File.Exists), "window failure preserves prepared files");
                windowResult = PhotoWindowResult.Opened;
                bridge.LastBatch.expires = DateTime.UtcNow.AddSeconds(-1);
                Check(Call("/v1/open-photo-window", copyBody, token).status == 404, "photo window rejects expired batch");
                bridge.LastBatch.expires = DateTime.UtcNow.AddMinutes(5);
                Check(Call("/v1/copy", copyBody, otherToken).status == 404 && copied == null, "batch bound to session");
                Check((bool)Call("/v1/copy", copyBody, token).data["copied"] && copied.SequenceEqual(paths), "whole file list copied");
                failCopy = true;
                Check(!(bool)Call("/v1/copy", copyBody, token).data["copied"] && paths.All(File.Exists), "clipboard failure preserves saved files");
                failCopy = false;
                var savedAgain = Call("/v1/prepare", pack, token);
                Check(savedAgain.status == 200 && Path.Combine(directory, bridge.LastBatch.folderName) != folder, "never overwrite existing batch");
                int before = Directory.GetDirectories(directory).Length;
                Check(Call("/v1/prepare", Pack(new[] { "one.jpg", "bad.png" }, new[] { jpg, jpg }, new[] { "image/jpeg", "image/png" }), token).status == 400 && Directory.GetDirectories(directory).Length == before, "invalid signature rolls back this batch only");
                Check(Call("/v1/prepare", Pack(new[] { "bad.exe" }, new[] { jpg }, new[] { "application/octet-stream" }), token).status == 400, "non-image rejected");
                Check(Call("/v1/prepare", new byte[] { 255, 255, 255, 127 }, token).status == 400, "manifest bound");
                Check(Call("/v1/copy", Encoding.UTF8.GetBytes("{\"batchId\":\"C:\\\\secret\"}"), token).status == 404, "arbitrary path copy denied");

                var old = Path.Combine(directory, "신분증_사진_20260101_000000_abcdef12");
                Directory.CreateDirectory(old); TemporaryPhotos.Mark(old); File.WriteAllBytes(Path.Combine(old, "001_test.jpg"), jpg);
                Directory.SetLastWriteTimeUtc(old, DateTime.UtcNow.AddHours(-25));
                TemporaryPhotos.Prune(directory, DateTime.UtcNow, candidate => candidate == old);
                Check(Directory.Exists(old), "keep a batch still referenced by clipboard");
                TemporaryPhotos.Prune(directory, DateTime.UtcNow, candidate => false);
                Check(!Directory.Exists(old) && Directory.Exists(folder), "expire only old owned batches; keep current ones");
                Directory.CreateDirectory(old); File.WriteAllBytes(Path.Combine(old, "001_test.jpg"), jpg);
                Directory.SetLastWriteTimeUtc(old, DateTime.UtcNow.AddHours(-25));
                TemporaryPhotos.Prune(directory, DateTime.UtcNow, candidate => false);
                Check(Directory.Exists(old), "unmarked folders are never deleted");
                TemporaryPhotos.Mark(old); File.WriteAllText(Path.Combine(old, "unrelated.txt"), "synthetic unrelated file");
                Directory.SetLastWriteTimeUtc(old, DateTime.UtcNow.AddHours(-25));
                TemporaryPhotos.Prune(directory, DateTime.UtcNow, candidate => false);
                Check(File.Exists(Path.Combine(old, "unrelated.txt")), "never delete unrelated files in modified batches");

                TestChunks(bridge, directory, token, otherToken, jpg, png);
                waitForDisconnect = true;
                using (var pendingClient = new TcpClient("127.0.0.1", 43128)) {
                    var stream = pendingClient.GetStream();
                    var header = Encoding.ASCII.GetBytes("POST /v1/open-photo-window HTTP/1.1\r\nHost: 127.0.0.1:43128\r\nOrigin: " + Bridge.Origin +
                        "\r\nX-CY-Photo-Protocol: 2\r\nAuthorization: Bearer " + token + "\r\nContent-Type: application/json\r\nContent-Length: " + copyBody.Length + "\r\n\r\n");
                    stream.Write(header, 0, header.Length); stream.Write(copyBody, 0, copyBody.Length);
                    Check(windowStarted.Wait(2000), "photo window request reaches pending preparation");
                    pendingClient.Client.Shutdown(SocketShutdown.Both);
                    pendingClient.Close();
                    Check(windowCancelled.Wait(2000), "browser disconnect cancels pending native preparation");
                    Check(Interlocked.CompareExchange(ref lateOpenCommits, 0, 0) == 0, "disconnected pending request cannot commit a late photo window");
                }
            }
            Console.WriteLine("PASS: " + passed + " native helper checks");
        }
        static T Pump<T>(Task<T> task) {
            var until = DateTime.UtcNow.AddSeconds(15);
            while (!task.IsCompleted && DateTime.UtcNow < until) { Application.DoEvents(); Thread.Sleep(20); }
            if (!task.IsCompleted) throw new InvalidOperationException("UI test timeout");
            return task.Result;
        }
        static bool Above(IntPtr upper, IntPtr lower) {
            var seen = new HashSet<IntPtr>();
            for (var next = GetWindow(lower, 3); next != IntPtr.Zero && seen.Add(next); next = GetWindow(next, 3))
                if (next == upper) return true;
            return false;
        }
        static byte[] Encode(object value) { return Encoding.UTF8.GetBytes(Json.Serialize(value)); }
        static byte[] Chunk(string id, int index, long offset, byte[] bytes) {
            var meta = Encode(new { batchId = id, index, offset });
            return BitConverter.GetBytes(meta.Length).Concat(meta).Concat(bytes).ToArray();
        }
        static void TestChunks(Bridge bridge, string directory, string token, string otherToken, byte[] jpg, byte[] png) {
            var id = Guid.NewGuid().ToString("N");
            var first = new byte[1024 * 1024 + 19]; Array.Copy(jpg, first, jpg.Length);
            var start = Encode(new { batchId = id, files = new[] { new { name = "one.jpg", type = "image/jpeg", size = first.Length }, new { name = "two.png", type = "image/png", size = png.Length } } });
            var command = Encode(new { batchId = id });
            var before = Directory.GetDirectories(directory).Length;
            Check(Call("/v1/prepare/start", start, token).status == 200, "chunk transfer starts without copying");
            Check(Call("/v1/prepare/start", start, token).status == 200 && Directory.GetDirectories(directory).Length == before + 1, "lost start response retry reuses one batch");
            Check(Call("/v1/prepare/start", start, otherToken).status == 409, "chunk start bound to session");
            Check(Call("/v1/prepare/finish", command, token).status == 409 && Call("/v1/open-photo-window", command, token).status == 404, "incomplete batch cannot finish or open");
            var part = Chunk(id, 0, 0, first.Take(1024 * 1024).ToArray());
            Check(Call("/v1/prepare/chunk", Chunk(id, 0, 0, jpg), otherToken).status == 404, "chunk transfer rejects another session");
            using (var interrupted = new TcpClient("127.0.0.1", 43128)) {
                interrupted.ReceiveTimeout = 5000;
                var stream = interrupted.GetStream();
                var header = Encoding.ASCII.GetBytes("POST /v1/prepare/chunk HTTP/1.1\r\nHost: 127.0.0.1:43128\r\nOrigin: " + Bridge.Origin + "\r\nX-CY-Photo-Protocol: 2\r\nAuthorization: Bearer " + token + "\r\nContent-Type: application/octet-stream\r\nContent-Length: " + part.Length + "\r\n\r\n");
                stream.Write(header, 0, header.Length); stream.Write(part, 0, 1024); interrupted.Client.Shutdown(SocketShutdown.Send);
                var response = new StreamReader(stream).ReadToEnd();
                Check(response.Contains("408 Response") && response.Contains("transfer-interrupted"), "interrupted body returns a retryable transfer error");
            }
            Check(Call("/v1/prepare/chunk", part, token).status == 200, "first bounded chunk received");
            Check(Call("/v1/prepare/chunk", part, token).status == 200, "lost chunk acknowledgement is safely replayed");
            var altered = (byte[])part.Clone(); altered[altered.Length - 1] = 7;
            Check(Call("/v1/prepare/chunk", altered, token).status == 409, "replay cannot silently replace bytes");
            Check(Call("/v1/prepare/chunk", Chunk(id, 0, 1024 * 1024 + 1, new byte[] { 1 }), token).status == 409, "out of order offset rejected");
            Check(Call("/v1/prepare/chunk", Chunk(id, 0, 1024 * 1024, first.Skip(1024 * 1024).ToArray()), token).status == 200, "tail chunk appended");
            Check(Call("/v1/prepare/chunk", Chunk(id, 1, 0, jpg), token).status == 400, "invalid photo signature rejected");
            Check(Call("/v1/prepare/chunk", Chunk(id, 1, 0, png), token).status == 200, "next original photo received");
            Check(Call("/v1/prepare/finish", command, token).status == 200 && Call("/v1/prepare/finish", command, token).status == 200, "finish reply loss is idempotent");
            Check(bridge.LastBatch.paths.Length == 2 && File.ReadAllBytes(bridge.LastBatch.paths[0]).SequenceEqual(first) && File.ReadAllBytes(bridge.LastBatch.paths[1]).SequenceEqual(png), "chunk retries preserve exact original byte arrays and count");
            Check(Call("/v1/prepare/cancel", command, token).status == 200 && bridge.LastBatch.paths.All(File.Exists), "cancel never removes a completed batch");
            var cancelId = Guid.NewGuid().ToString("N");
            var cancelStart = Encode(new { batchId = cancelId, files = new[] { new { name = "cancel.jpg", type = "image/jpeg", size = jpg.Length } } });
            Check(Call("/v1/prepare/start", cancelStart, token).status == 200 && Call("/v1/prepare/chunk", Chunk(cancelId, 0, 0, jpg), token).status == 200, "cancellable batch prepared");
            var cancel = Encode(new { batchId = cancelId });
            Check(Call("/v1/prepare/cancel", cancel, otherToken).status == 200 && Call("/v1/prepare/start", cancelStart, token).status == 200, "another session cannot cancel an upload");
            Check(Call("/v1/prepare/cancel", cancel, token).status == 200 && Directory.GetDirectories(directory).Length == before + 1, "cancel removes only its unfinished files");
            var invalid = Encode(new { batchId = "../../outside", files = new[] { new { name = "one.jpg", type = "image/jpeg", size = jpg.Length } } });
            Check(Call("/v1/prepare/start", invalid, token).status == 400, "start rejects path identifiers");
        }
    }
}
