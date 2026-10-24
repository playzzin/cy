using System;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using ComData = System.Runtime.InteropServices.ComTypes.IDataObject;

namespace CyPhotoClipboard {
    public static class NativeClipboard {
        // Keep the OLE owner/message loop alive until shutdown, as Explorer does.
        // A file list that survives a short-lived worker is not sufficient for every paste target.
        static readonly Lazy<Owner> owner = new Lazy<Owner>(() => new Owner());
        public static void Copy(string[] paths) {
            if (paths == null || paths.Length == 0 || paths.Length > 100) throw new ArgumentException("photos-required");
            var files = paths.Select(Path.GetFullPath).ToArray();
            var folder = Path.GetDirectoryName(files[0]);
            if (files.Distinct(StringComparer.OrdinalIgnoreCase).Count() != files.Length ||
                files.Any(file => !File.Exists(file) || !string.Equals(Path.GetDirectoryName(file), folder, StringComparison.OrdinalIgnoreCase)))
                throw new ArgumentException("one-existing-photo-batch-required");
            owner.Value.Copy(files);
        }

        public static void Shutdown() {
            if (owner.IsValueCreated) owner.Value.Stop();
        }

        sealed class Owner {
            readonly Thread thread;
            readonly ManualResetEvent ready = new ManualResetEvent(false);
            Control dispatcher;
            Exception startupFailure;
            ComData current;
            bool stopping;
            public Owner() {
                thread = new Thread(Run) { IsBackground = true, Name = "CY clipboard owner" };
                thread.SetApartmentState(ApartmentState.STA); thread.Start();
                ready.WaitOne(); ready.Dispose();
                if (startupFailure != null) throw new InvalidOperationException("clipboard-owner-unavailable", startupFailure);
            }
            void Run() {
                bool initialized = false;
                try {
                    Marshal.ThrowExceptionForHR(OleInitialize(IntPtr.Zero)); initialized = true;
                    dispatcher = new Control(); var handle = dispatcher.Handle;
                } catch (Exception error) { startupFailure = error; }
                finally { ready.Set(); }
                try { if (startupFailure == null) Application.Run(); }
                finally {
                    ReleaseCurrent(true);
                    if (dispatcher != null) dispatcher.Dispose();
                    if (initialized) OleUninitialize();
                }
            }
            public void Copy(string[] paths) {
                if (stopping) throw new InvalidOperationException("clipboard-owner-stopped");
                dispatcher.Invoke((Action)delegate {
                    ComData next = CreateShellData(paths);
                    try {
                        int result = unchecked((int)0x800401D0);
                        for (int attempt = 0; attempt < 10; attempt++) {
                            result = OleSetClipboard(next);
                            if (result >= 0) break;
                            Thread.Sleep(100);
                        }
                        Marshal.ThrowExceptionForHR(result);
                        ReleaseCurrent(false); current = next; next = null;
                        bool matches = Matches(paths), shell = IsClipboardFormatAvailable(RegisterClipboardFormat("Shell IDList Array"));
                        if (!matches || !shell)
                            throw new InvalidOperationException("clipboard-verification-failed");
                    } finally { if (next != null) Marshal.ReleaseComObject(next); }
                });
            }
            public void Stop() {
                if (stopping) return;
                stopping = true;
                if (!thread.IsAlive) return;
                dispatcher.Invoke((Action)Application.ExitThread);
                thread.Join(5000);
            }
            void ReleaseCurrent(bool persist) {
                if (current == null) return;
                if (persist && OleIsCurrentClipboard(current) == 0) OleFlushClipboard();
                Marshal.ReleaseComObject(current); current = null;
            }
        }

        static ComData CreateShellData(string[] paths) {
            var pidls = new IntPtr[paths.Length];
            IShellItemArray items = null; ComData data = null;
            try {
                for (int index = 0; index < paths.Length; index++) {
                    uint attributes;
                    Marshal.ThrowExceptionForHR(SHParseDisplayName(paths[index], IntPtr.Zero, out pidls[index], 0, out attributes));
                }
                Marshal.ThrowExceptionForHR(SHCreateShellItemArrayFromIDLists((uint)pidls.Length, pidls, out items));
                var handler = new Guid("B8C0BD9F-ED24-455C-83E6-D5390C4FE8C4");
                var iid = new Guid("0000010E-0000-0000-C000-000000000046");
                items.BindToHandler(IntPtr.Zero, ref handler, ref iid, out data);
                SetCopyEffect(data);
                var result = data; data = null; return result;
            } finally {
                if (data != null) Marshal.ReleaseComObject(data);
                if (items != null) Marshal.ReleaseComObject(items);
                foreach (var pidl in pidls) if (pidl != IntPtr.Zero) Marshal.FreeCoTaskMem(pidl);
            }
        }

        static void SetCopyEffect(ComData data) {
            var memory = GlobalAlloc(0x42, (UIntPtr)4);
            if (memory == IntPtr.Zero) throw new OutOfMemoryException();
            var medium = new STGMEDIUM { tymed = TYMED.TYMED_HGLOBAL, unionmember = memory, pUnkForRelease = null };
            bool transferred = false;
            try {
                var pointer = GlobalLock(memory);
                if (pointer == IntPtr.Zero) throw new InvalidOperationException("clipboard-memory-unavailable");
                try { Marshal.WriteInt32(pointer, 1); } finally { GlobalUnlock(memory); }
                var format = new FORMATETC { cfFormat = unchecked((short)RegisterClipboardFormat("Preferred DropEffect")),
                    dwAspect = DVASPECT.DVASPECT_CONTENT, lindex = -1, tymed = TYMED.TYMED_HGLOBAL };
                data.SetData(ref format, ref medium, true); transferred = true;
            } finally { if (!transferred) ReleaseStgMedium(ref medium); }
        }

        public static bool Matches(string[] paths) {
            var current = ReadFiles();
            if (current.Length != paths.Length) return false;
            // Shell objects can normalize item order; verify the exact set without accepting duplicates.
            var expected = new System.Collections.Generic.HashSet<string>(paths, StringComparer.OrdinalIgnoreCase);
            return expected.Count == paths.Length && current.All(file => expected.Remove(file) && File.Exists(file)) && expected.Count == 0;
        }

        public static bool UsesFolder(string folder) {
            // Called on the tray's STA thread. Never expose clipboard contents to the website.
            try {
                var prefix = Path.GetFullPath(folder) + Path.DirectorySeparatorChar;
                foreach (string file in ReadFiles()) {
                    if (Path.GetFullPath(file).StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return true;
                }
                return false;
            } catch { return true; } // Keep temporary files if clipboard ownership cannot be determined.
        }

        static string[] ReadFiles() {
            bool opened = false;
            for (int attempt = 0; attempt < 10 && !opened; attempt++) {
                opened = OpenClipboard(IntPtr.Zero);
                if (!opened) Thread.Sleep(20);
            }
            if (!opened) throw new InvalidOperationException("clipboard-busy");
            try {
                var drop = GetClipboardData(15);
                if (drop == IntPtr.Zero) return new string[0];
                uint count = DragQueryFile(drop, UInt32.MaxValue, null, 0);
                if (count > 10000) throw new InvalidOperationException("clipboard-list-too-large");
                var files = new string[count];
                for (uint index = 0; index < count; index++) {
                    uint length = DragQueryFile(drop, index, null, 0);
                    if (length == 0 || length > 32767) throw new InvalidOperationException("clipboard-path-invalid");
                    var name = new StringBuilder((int)length + 1);
                    if (DragQueryFile(drop, index, name, length + 1) != length) throw new InvalidOperationException("clipboard-path-invalid");
                    files[index] = name.ToString();
                }
                return files;
            } finally { CloseClipboard(); }
        }

        // Only BindToHandler is used; it is the first IShellItemArray vtable method.
        [ComImport, Guid("B63EA76D-1F85-456F-A19C-48159EFA858B"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IShellItemArray {
            void BindToHandler(IntPtr context, ref Guid handler, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out ComData result);
        }
        [DllImport("shell32.dll", CharSet = CharSet.Unicode)] static extern int SHParseDisplayName(string name, IntPtr context, out IntPtr pidl, uint input, out uint attributes);
        [DllImport("shell32.dll")] static extern int SHCreateShellItemArrayFromIDLists(uint count, [In] IntPtr[] pidls, out IShellItemArray items);
        [DllImport("ole32.dll")] static extern int OleInitialize(IntPtr reserved);
        [DllImport("ole32.dll")] static extern void OleUninitialize();
        [DllImport("ole32.dll")] static extern int OleSetClipboard(ComData data);
        [DllImport("ole32.dll")] static extern int OleFlushClipboard();
        [DllImport("ole32.dll")] static extern int OleIsCurrentClipboard(ComData data);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern uint RegisterClipboardFormat(string format);
        [DllImport("user32.dll")] static extern bool IsClipboardFormatAvailable(uint format);
        [DllImport("user32.dll")] static extern bool OpenClipboard(IntPtr owner);
        [DllImport("user32.dll")] static extern bool CloseClipboard();
        [DllImport("user32.dll")] static extern IntPtr GetClipboardData(uint format);
        [DllImport("shell32.dll", CharSet = CharSet.Unicode)] static extern uint DragQueryFile(IntPtr drop, uint index, StringBuilder name, uint size);
        [DllImport("kernel32.dll")] static extern IntPtr GlobalAlloc(uint flags, UIntPtr bytes);
        [DllImport("kernel32.dll")] static extern IntPtr GlobalLock(IntPtr memory);
        [DllImport("kernel32.dll")] static extern bool GlobalUnlock(IntPtr memory);
        [DllImport("ole32.dll")] static extern void ReleaseStgMedium(ref STGMEDIUM medium);
    }
}
