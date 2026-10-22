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
                } catch (Exception error) { failure = error; }
            });
            worker.SetApartmentState(ApartmentState.STA); worker.Start(); worker.Join();
            if (failure != null) throw new InvalidOperationException("clipboard-unavailable", failure);
        }
    }
}
