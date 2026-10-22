using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Sockets;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace CyPhotoClipboard {
    public static class Tests {
        static int passed;
        static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
        sealed class Response { public int status; public string raw; public Dictionary<string, object> data; }
        static void Check(bool condition, string label) { if (!condition) throw new Exception(label); passed++; Console.WriteLine("PASS " + label); }
        static Response Send(string path, byte[] body, string token, string origin, string extra, string method) {
            using (var client = new TcpClient("127.0.0.1", 43128)) {
                client.ReceiveTimeout = 20000;
                using (var stream = client.GetStream()) {
                    var header = method + " " + path + " HTTP/1.1\r\nHost: 127.0.0.1:43128\r\n" + (origin == null ? "" : "Origin: " + origin + "\r\n") +
                        "X-CY-Photo-Protocol: 1\r\n" + (token == null ? "" : "Authorization: Bearer " + token + "\r\n") +
                        "Content-Type: " + (path == "/v1/copy" ? "application/json" : "application/octet-stream") + "\r\nContent-Length: " + (body == null ? 0 : body.Length) + "\r\n" + extra + "\r\n";
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
        }
        static void Run(string[] args) {
            if (args.Length == 2 && args[0] == "--serve") {
                using (var server = new Bridge(args[1], NativeClipboard.Copy, Bridge.Port)) { server.Start(); Console.WriteLine("ready"); Console.ReadLine(); }
                return;
            }
            if (args.Length == 2 && args[0] == "--verify-clipboard") {
                var root = Path.GetFullPath(args[1]) + Path.DirectorySeparatorChar;
                var files = Clipboard.GetFileDropList().Cast<string>().ToArray();
                Check(files.Length == 2 && files.All(file => Path.GetFullPath(file).StartsWith(root, StringComparison.OrdinalIgnoreCase) && File.Exists(file)), "two expected synthetic files in real Windows clipboard");
                Console.WriteLine("Verified Windows FileDrop: 2 existing synthetic photos"); return;
            }
            if (args.Length != 1) throw new ArgumentException("Supply test output folder");
            var directory = Path.GetFullPath(args[0]); Directory.CreateDirectory(directory);
            var jpg = new byte[] { 255, 216, 255, 224, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 };
            var png = new byte[] { 137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3, 4, 5 };
            var pack = Pack(new[] { "테스트.jpg", "../../CON:evil.exe.png" }, new[] { jpg, png }, new[] { "image/jpeg", "image/png" });
            string[] copied = null;
            bool failCopy = false;
            using (var bridge = new Bridge(directory, paths => { if (failCopy) throw new Exception(); copied = paths; }, 43128)) {
                bridge.Start();
                var denied = Send("/v1/session", null, null, "https://untrusted.example", "", "GET");
                Check(denied.status == 403 && !denied.raw.Contains("Access-Control-Allow-Origin"), "untrusted origin denied");
                Check(Send("/v1/session", null, null, null, "", "GET").status == 403, "missing origin denied");
                Check(Send("/v1/session", null, null, "null", "", "GET").status == 403, "null origin denied");
                Check(Send("/v1/session", null, null, Bridge.Origin, "Host: attacker.example\r\n", "GET").status == 400, "duplicate host denied");
                Check(Send("/v1/save", null, null, Bridge.Origin, "Access-Control-Request-Method: POST\r\nAccess-Control-Request-Headers: authorization,content-type,x-cy-photo-protocol\r\n", "OPTIONS").status == 204, "CORS preflight");
                Check(Send("/v1/save", pack, null, Bridge.Origin, "", "POST").status == 403, "missing session denied");
                var session = Call("/v1/session"); var token = (string)session.data["token"];
                Check(session.status == 200 && token.Length == 64, "ephemeral session");
                Check(Call("/v1/save", pack, "wrong").status == 403, "wrong token denied");
                Check(Send("/v1/save", pack, token, Bridge.Origin, "Transfer-Encoding: chunked\r\n", "POST").status == 400, "ambiguous framing denied");
                var saved = Call("/v1/save", pack, token);
                Check(saved.status == 200 && (int)saved.data["savedCount"] == 2 && copied == null, "save does not copy before commit");
                var batch = (string)saved.data["batchId"];
                var folder = Path.Combine(directory, (string)saved.data["folderName"]);
                var paths = Directory.GetFiles(folder).OrderBy(p => p).ToArray();
                Check(paths.Length == 2 && paths.All(p => Path.GetDirectoryName(p) == folder), "path traversal confined");
                Check(File.ReadAllBytes(paths[0]).SequenceEqual(jpg) && File.ReadAllBytes(paths[1]).SequenceEqual(png), "original bytes preserved");
                var copyBody = Encoding.UTF8.GetBytes(Json.Serialize(new { batchId = batch }));
                var otherToken = (string)Call("/v1/session").data["token"];
                Check(Call("/v1/copy", copyBody, otherToken).status == 404 && copied == null, "batch bound to session");
                Check((bool)Call("/v1/copy", copyBody, token).data["copied"] && copied.SequenceEqual(paths), "whole file list copied");
                failCopy = true;
                Check(!(bool)Call("/v1/copy", copyBody, token).data["copied"] && paths.All(File.Exists), "clipboard failure preserves saved files");
                failCopy = false;
                var savedAgain = Call("/v1/save", pack, token);
                Check(savedAgain.status == 200 && (string)savedAgain.data["folderName"] != (string)saved.data["folderName"], "never overwrite existing batch");
                int before = Directory.GetDirectories(directory).Length;
                Check(Call("/v1/save", Pack(new[] { "one.jpg", "bad.png" }, new[] { jpg, jpg }, new[] { "image/jpeg", "image/png" }), token).status == 400 && Directory.GetDirectories(directory).Length == before, "invalid signature rolls back this batch only");
                Check(Call("/v1/save", Pack(new[] { "bad.exe" }, new[] { jpg }, new[] { "application/octet-stream" }), token).status == 400, "non-image rejected");
                Check(Call("/v1/save", new byte[] { 255, 255, 255, 127 }, token).status == 400, "manifest bound");
                Check(Call("/v1/copy", Encoding.UTF8.GetBytes("{\"batchId\":\"C:\\\\secret\"}"), token).status == 404, "arbitrary path copy denied");
            }
            Console.WriteLine("PASS: " + passed + " native helper checks");
        }
    }
}
