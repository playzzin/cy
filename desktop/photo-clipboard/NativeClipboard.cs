using System;
using System.Collections.Specialized;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace CyPhotoClipboard {
    public static class NativeClipboard {
        public static void Copy(string[] paths) {
            Exception failure = null;
            var worker = new Thread(delegate() {
                try {
                    var files = new StringCollection(); files.AddRange(paths);
                    var data = new DataObject(); data.SetFileDropList(files);
                    data.SetData("Preferred DropEffect", new MemoryStream(BitConverter.GetBytes(1)));
                    // Persist all files after the STA thread exits; retry if another app holds the clipboard.
                    Clipboard.SetDataObject(data, true, 10, 100);
                    if (!Matches(paths)) throw new InvalidOperationException("clipboard-verification-failed");
                } catch (Exception error) { failure = error; }
            });
            worker.SetApartmentState(ApartmentState.STA); worker.Start(); worker.Join();
            if (failure != null) throw new InvalidOperationException("clipboard-unavailable", failure);
        }

        public static bool Matches(string[] paths) {
            var current = Clipboard.GetFileDropList();
            if (current.Count != paths.Length) return false;
            for (int index = 0; index < paths.Length; index++) {
                if (!string.Equals(current[index], paths[index], StringComparison.OrdinalIgnoreCase) || !File.Exists(paths[index])) return false;
            }
            return true;
        }

        public static bool UsesFolder(string folder) {
            // Called on the tray's STA thread. Never expose clipboard contents to the website.
            try {
                var prefix = Path.GetFullPath(folder) + Path.DirectorySeparatorChar;
                foreach (string file in Clipboard.GetFileDropList()) {
                    if (Path.GetFullPath(file).StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return true;
                }
                return false;
            } catch { return true; } // Keep temporary files if clipboard ownership cannot be determined.
        }
    }
}
