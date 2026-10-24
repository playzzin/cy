using System;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace CyPhotoClipboard {
    public static class TemporaryPhotos {
        public const string Marker = ".cy-photo-cache";
        const string Owner = "cy-photo-clipboard/v2";
        public static void Mark(string folder) { File.WriteAllText(Path.Combine(folder, Marker), Owner); }
        static bool Regular(string path) { return (File.GetAttributes(path) & FileAttributes.ReparsePoint) == 0; }
        public static void Prune(string root, DateTime now, Func<string, bool> clipboardUsesFolder) {
            if (!Directory.Exists(root) || !Regular(root)) return;
            string prefix = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            foreach (var folder in Directory.GetDirectories(root)) {
                try {
                    // Never recursively delete. Only this app's marked, flat temporary photo batches.
                    if (!Path.GetFullPath(folder).StartsWith(prefix, StringComparison.OrdinalIgnoreCase) || !Regular(folder) ||
                        !Regex.IsMatch(Path.GetFileName(folder), @"^신분증_사진_\d{8}_\d{6}_[a-f0-9]{8}$") ||
                        Directory.GetLastWriteTimeUtc(folder) > now.AddHours(-24) || Directory.GetDirectories(folder).Length != 0) continue;
                    var marker = Path.Combine(folder, Marker);
                    if (!File.Exists(marker) || !Regular(marker) || new FileInfo(marker).Length != Owner.Length || File.ReadAllText(marker) != Owner) continue;
                    var files = Directory.GetFiles(folder);
                    if (files.Any(file => !Regular(file) || (Path.GetFileName(file) != Marker && !Regex.IsMatch(Path.GetFileName(file), @"^\d{3}_.+\.(jpg|png|gif|webp|bmp)$")))) continue;
                    if (clipboardUsesFolder(folder)) continue;
                    foreach (var file in files) File.Delete(file);
                    Directory.Delete(folder, false);
                } catch { /* A locked/changed batch is kept for the next cleanup. */ }
            }
        }
    }
}
