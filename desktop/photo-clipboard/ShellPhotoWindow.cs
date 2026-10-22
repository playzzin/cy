using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using ComData = System.Runtime.InteropServices.ComTypes.IDataObject;

namespace CyPhotoClipboard {
    public enum PhotoWindowResult { Failed, Opened, Busy }

    // Owned by the existing tray UI thread. Browser requests only show a native
    // Shell view; Windows Shell starts the drag from the user's actual mouse input.
    public sealed class ShellPhotoWindows : IDisposable {
        readonly Control dispatcher;
        readonly string root;
        readonly object sync = new object();
        readonly Dictionary<string, DateTime> grace = new Dictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        readonly bool hidden;
        readonly int timeout;
        readonly Func<bool> interactionInProgress;
        Request active;
        ShellPhotoWindow window;
        bool stopped;
        sealed class Request {
            internal string id, folder; internal string[] paths;
            internal volatile bool cancelled;
            internal readonly TaskCompletionSource<PhotoWindowResult> done = new TaskCompletionSource<PhotoWindowResult>();
        }
        public ShellPhotoWindows(Control uiDispatcher, string cacheRoot) : this(uiDispatcher, cacheRoot, false, 10000) { }
        internal ShellPhotoWindows(Control uiDispatcher, string cacheRoot, bool hide, int waitMilliseconds, Func<bool> interaction = null) {
            dispatcher = uiDispatcher; var handle = dispatcher.Handle;
            root = Path.GetFullPath(cacheRoot).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            hidden = hide; timeout = waitMilliseconds;
            interactionInProgress = interaction ?? (() => GetCapture() != IntPtr.Zero ||
                ((GetAsyncKeyState(1) | GetAsyncKeyState(2) | GetAsyncKeyState(4)) & 0x8000) != 0);
        }
        bool Validate(string id, string[] paths) {
            if (string.IsNullOrEmpty(id) || id.Length != 32 || id.Any(c => !"0123456789abcdef".Contains(c)) || paths == null || paths.Length == 0 || paths.Length > 100) return false;
            try {
                string folder = Path.GetDirectoryName(Path.GetFullPath(paths[0]));
                if (!folder.StartsWith(root, StringComparison.OrdinalIgnoreCase) || !File.Exists(Path.Combine(folder, TemporaryPhotos.Marker)) ||
                    (File.GetAttributes(root) & FileAttributes.ReparsePoint) != 0 || (File.GetAttributes(folder) & FileAttributes.ReparsePoint) != 0) return false;
                return paths.Distinct(StringComparer.OrdinalIgnoreCase).Count() == paths.Length && paths.All(p =>
                    string.Equals(Path.GetDirectoryName(Path.GetFullPath(p)), folder, StringComparison.OrdinalIgnoreCase) &&
                    File.Exists(p) && (File.GetAttributes(p) & FileAttributes.ReparsePoint) == 0);
            } catch { return false; }
        }
        public PhotoWindowResult Open(string id, string[] paths, CancellationToken cancellation) {
            if (cancellation.IsCancellationRequested || !Validate(id, paths)) return PhotoWindowResult.Failed;
            var request = new Request { id = id, paths = paths.Select(Path.GetFullPath).ToArray(), folder = Path.GetDirectoryName(Path.GetFullPath(paths[0])) };
            lock (sync) { if (stopped) return PhotoWindowResult.Failed; }
            try { dispatcher.BeginInvoke((Action)delegate { OpenOnUi(request); }); }
            catch { return PhotoWindowResult.Failed; }
            var until = DateTime.UtcNow.AddMilliseconds(timeout);
            while (!request.done.Task.IsCompleted && !cancellation.IsCancellationRequested && DateTime.UtcNow < until) request.done.Task.Wait(50);
            if (request.done.Task.IsCompleted && !cancellation.IsCancellationRequested) return request.done.Task.Result;
            request.cancelled = true;
            try { dispatcher.BeginInvoke((Action)delegate { if (ReferenceEquals(active, request) && window != null) window.Close(); }); } catch { }
            return PhotoWindowResult.Failed;
        }
        void OpenOnUi(Request request) {
            lock (sync) { if (stopped || request.cancelled) { request.done.TrySetResult(PhotoWindowResult.Failed); return; } }
            if (window != null) {
                // Shell drag uses a nested message loop. Do not dispose its source
                // view, or change focus, while the user is holding/capturing input.
                if (interactionInProgress()) { request.done.TrySetResult(PhotoWindowResult.Busy); return; }
                bool same = active.id == request.id && active.paths.SequenceEqual(request.paths, StringComparer.OrdinalIgnoreCase);
                if (same && window.Ready) { window.Present(); request.done.TrySetResult(PhotoWindowResult.Opened); return; }
                if (!window.Ready) { window.Present(); request.done.TrySetResult(PhotoWindowResult.Busy); return; }
            }
            try {
                // Each website click prepares a new batch, even for the same
                // photos. Replace the idle view instead of blocking on its ID.
                // FormClosed preserves the previous batch for pending recipients.
                if (window != null) window.Close();
                lock (sync) { active = request; }
                window = new ShellPhotoWindow(request.paths, hidden);
                var created = window;
                created.FormClosed += delegate {
                    lock (sync) {
                        grace[request.folder] = DateTime.UtcNow.AddMinutes(10);
                        // Preserve the grace period across helper restart, too. Only this
                        // already validated owned batch is touched; no immediate deletion.
                        try { Directory.SetLastWriteTimeUtc(request.folder, DateTime.UtcNow); } catch { }
                        if (ReferenceEquals(window, created)) { window = null; active = null; }
                    }
                    request.done.TrySetResult(PhotoWindowResult.Failed);
                };
                created.Prepared += delegate(bool ready) {
                    if (!ready || request.cancelled) { created.Close(); request.done.TrySetResult(PhotoWindowResult.Failed); }
                    else request.done.TrySetResult(PhotoWindowResult.Opened);
                };
                created.Present();
            } catch {
                if (window != null) { window.Dispose(); window = null; }
                lock (sync) { active = null; }
                request.done.TrySetResult(PhotoWindowResult.Failed);
            }
        }
        public bool UsesFolder(string folder) {
            lock (sync) {
                if (active != null && string.Equals(active.folder, Path.GetFullPath(folder), StringComparison.OrdinalIgnoreCase)) return true;
                foreach (string old in grace.Where(p => p.Value < DateTime.UtcNow).Select(p => p.Key).ToArray()) grace.Remove(old);
                return grace.ContainsKey(Path.GetFullPath(folder));
            }
        }
        internal void CloseCurrent() { if (window != null) window.Close(); }
        internal int OpenWindowCount { get { return window == null ? 0 : 1; } }
        [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
        [DllImport("user32.dll")] static extern IntPtr GetCapture();
        public void Dispose() {
            lock (sync) { stopped = true; if (active != null) { active.cancelled = true; active.done.TrySetResult(PhotoWindowResult.Failed); } }
            if (window != null) { var closing = window; closing.Close(); closing.Dispose(); window = null; }
        }
    }

    internal sealed class ShellPhotoWindow : Form {
        readonly string[] paths;
        readonly bool hidden;
        readonly Panel host = new Panel { Dock = DockStyle.Fill };
        readonly Label status = new Label { Dock = DockStyle.Bottom, Height = 46, Padding = new Padding(14) };
        readonly CheckBox keepAbove = new CheckBox { Text = "맨 위에 표시", Dock = DockStyle.Top, Height = 32, Padding = new Padding(14, 0, 0, 0), Checked = true };
        readonly System.Windows.Forms.Timer poll = new System.Windows.Forms.Timer { Interval = 100 };
        readonly DateTime deadline = DateTime.UtcNow.AddSeconds(8);
        IExplorerBrowser browser;
        bool selected, completed, oleInitialized;
        internal bool Ready { get; private set; }
        internal event Action<bool> Prepared;
        protected override bool ShowWithoutActivation { get { return hidden; } }
        internal ShellPhotoWindow(string[] files, bool hide) {
            paths = files; hidden = hide;
            Text = "CY 사진 " + files.Length + "장 함께 첨부";
            ClientSize = new Size(760, 510); MinimumSize = new Size(520, 360);
            Font = new Font("Malgun Gothic", 10); StartPosition = FormStartPosition.CenterScreen;
            if (hide) { StartPosition = FormStartPosition.Manual; Location = new Point(-32000, -32000); Opacity = 0; ShowInTaskbar = false; }
            var instructions = new Label { Dock = DockStyle.Top, Height = 78, Padding = new Padding(14),
                Text = "선택된 사진 하나를 카카오톡 대화창으로 끌어놓으세요. 사진 " + files.Length + "장이 함께 첨부됩니다.\n사진과 받을 대화방을 확인한 뒤 카카오톡에서 전송하세요." };
            status.Text = "사진 목록을 준비하고 있습니다.";
            Controls.Add(host); Controls.Add(status); Controls.Add(keepAbove); Controls.Add(instructions);
            keepAbove.CheckedChanged += delegate { TopMost = !hidden && keepAbove.Checked; };
            host.Resize += delegate { if (browser != null) { var rect = Rect(); browser.SetRect(IntPtr.Zero, ref rect); } };
            Shown += delegate { try { InitializeView(); poll.Start(); } catch { Finish(false); } };
            poll.Tick += delegate { Poll(); };
        }
        // Browser HTTP requests do not grant foreground activation permission.
        // A topmost tool window stays visible without synthetic input or focus loops.
        internal void Present() {
            if (!hidden) {
                keepAbove.Checked = true;
                TopMost = true;
                if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
            }
            Show();
            if (!hidden) { BringToFront(); Activate(); }
        }
        void Finish(bool ready) {
            if (completed) return; completed = true; Ready = ready; poll.Stop();
            status.Text = ready ? "사진 " + paths.Length + "장이 모두 선택되었습니다." : "사진창을 준비하지 못했습니다. 사이트에서 다시 시도해 주세요.";
            if (Prepared != null) Prepared(ready);
        }
        void InitializeView() {
            Check(OleInitialize(IntPtr.Zero)); oleInitialized = true;
            browser = (IExplorerBrowser)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("71F96385-DDD6-48D3-A0C1-AE06E8B055FB")));
            Check(browser.SetOptions(0x1 | 0x8 | 0x40 | 0x80));
            var rect = Rect(); var settings = new FolderSettings { ViewMode = 5, Flags = 0x10000000 | 0x80000 | 0x100000 | 0x400000 };
            Check(browser.Initialize(host.Handle, ref rect, ref settings));
            IShellItemArray items = null; ComData data = null; var pidls = new IntPtr[paths.Length];
            try {
                for (int i = 0; i < paths.Length; i++) { uint attr; Check(SHParseDisplayName(paths[i], IntPtr.Zero, out pidls[i], 0, out attr)); }
                Check(SHCreateShellItemArrayFromIDLists((uint)pidls.Length, pidls, out items));
                var handler = new Guid("B8C0BD9F-ED24-455C-83E6-D5390C4FE8C4"); var iid = typeof(ComData).GUID;
                items.BindToHandler(IntPtr.Zero, ref handler, ref iid, out data);
                Check(browser.FillFromObject(data, 0x200)); // No parent enumeration, no source drop target.
            } finally {
                if (data != null) Marshal.ReleaseComObject(data); if (items != null) Marshal.ReleaseComObject(items);
                foreach (var pidl in pidls) if (pidl != IntPtr.Zero) Marshal.FreeCoTaskMem(pidl);
            }
        }
        void Poll() {
            if (DateTime.UtcNow > deadline) { Finish(false); return; }
            object value = null;
            try {
                var iid = typeof(IFolderView).GUID; if (browser.GetCurrentView(ref iid, out value) < 0 || value == null) return;
                var view = (IFolderView)value; int count;
                Check(view.ItemCount(2, out count)); if (count != paths.Length) return;
                if (!selected) { for (int i = 0; i < paths.Length; i++) Check(view.SelectItem(i, i == 0 ? 1u | 4 | 8 | 16 : 1u)); selected = true; }
                Check(view.ItemCount(1, out count)); if (count != paths.Length) return;
                if (!VerifySelection()) { Finish(false); return; }
                Finish(true);
            } catch { Finish(false); }
            finally { if (value != null && Marshal.IsComObject(value)) Marshal.ReleaseComObject(value); }
        }
        bool VerifySelection() {
            object value = null; ComData data = null;
            try {
                var iid = typeof(IShellView).GUID; Check(browser.GetCurrentView(ref iid, out value));
                var dataIid = typeof(ComData).GUID; Check(((IShellView)value).GetItemObject(1, ref dataIid, out data));
                var format = new FORMATETC { cfFormat = 15, dwAspect = DVASPECT.DVASPECT_CONTENT, lindex = -1, tymed = TYMED.TYMED_HGLOBAL };
                STGMEDIUM medium; data.GetData(ref format, out medium);
                try {
                    if (medium.tymed != TYMED.TYMED_HGLOBAL || medium.unionmember == IntPtr.Zero || DragQueryFile(medium.unionmember, UInt32.MaxValue, null, 0) != paths.Length) return false;
                    var expected = new HashSet<string>(paths, StringComparer.OrdinalIgnoreCase);
                    for (uint i = 0; i < paths.Length; i++) {
                        uint length = DragQueryFile(medium.unionmember, i, null, 0); if (length == 0 || length > 32767) return false;
                        var name = new StringBuilder((int)length + 1);
                        if (DragQueryFile(medium.unionmember, i, name, length + 1) != length || !expected.Remove(name.ToString())) return false;
                    }
                    return expected.Count == 0;
                } finally { ReleaseStgMedium(ref medium); }
            } finally { if (data != null) Marshal.ReleaseComObject(data); if (value != null && Marshal.IsComObject(value)) Marshal.ReleaseComObject(value); }
        }
        NativeRect Rect() { return new NativeRect { right = host.ClientSize.Width, bottom = host.ClientSize.Height }; }
        protected override void Dispose(bool disposing) {
            if (disposing) {
                poll.Dispose();
                if (browser != null) { browser.Destroy(); Marshal.ReleaseComObject(browser); browser = null; }
                if (oleInitialized) { OleUninitialize(); oleInitialized = false; }
            }
            base.Dispose(disposing);
        }
        static void Check(int hr) { Marshal.ThrowExceptionForHR(hr); }
        [StructLayout(LayoutKind.Sequential)] struct NativeRect { public int left, top, right, bottom; }
        [StructLayout(LayoutKind.Sequential)] struct FolderSettings { public uint ViewMode, Flags; }
        [ComImport, Guid("DFD3B6B5-C10C-4BE9-85F6-A66969F402F6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IExplorerBrowser {
            [PreserveSig] int Initialize(IntPtr parent, ref NativeRect rect, ref FolderSettings settings);
            [PreserveSig] int Destroy(); [PreserveSig] int SetRect(IntPtr defer, ref NativeRect rect);
            [PreserveSig] int SetPropertyBag([MarshalAs(UnmanagedType.LPWStr)] string name);
            [PreserveSig] int SetEmptyText([MarshalAs(UnmanagedType.LPWStr)] string text);
            [PreserveSig] int SetFolderSettings(ref FolderSettings settings);
            [PreserveSig] int Advise(IntPtr events, out uint cookie); [PreserveSig] int Unadvise(uint cookie);
            [PreserveSig] int SetOptions(uint options); [PreserveSig] int GetOptions(out uint options);
            [PreserveSig] int BrowseToIDList(IntPtr pidl, uint flags);
            [PreserveSig] int BrowseToObject([MarshalAs(UnmanagedType.IUnknown)] object value, uint flags);
            [PreserveSig] int FillFromObject([MarshalAs(UnmanagedType.IUnknown)] object value, uint flags);
            [PreserveSig] int RemoveAll(); [PreserveSig] int GetCurrentView(ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out object view);
        }
        [ComImport, Guid("CDE725B0-CCC9-4519-917E-325D72FAB4CE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IFolderView {
            [PreserveSig] int GetCurrentViewMode(out uint mode); [PreserveSig] int SetCurrentViewMode(uint mode);
            [PreserveSig] int GetFolder(ref Guid iid, out IntPtr folder); [PreserveSig] int Item(int index, out IntPtr pidl);
            [PreserveSig] int ItemCount(uint flags, out int count); [PreserveSig] int Items(uint flags, ref Guid iid, out IntPtr items);
            [PreserveSig] int GetSelectionMarkedItem(out int index); [PreserveSig] int GetFocusedItem(out int index);
            [PreserveSig] int GetItemPosition(IntPtr pidl, IntPtr point); [PreserveSig] int GetSpacing(IntPtr point);
            [PreserveSig] int GetDefaultSpacing(IntPtr point); [PreserveSig] int GetAutoArrange();
            [PreserveSig] int SelectItem(int index, uint flags); [PreserveSig] int SelectAndPositionItems(uint count, IntPtr items, IntPtr points, uint flags);
        }
        [ComImport, Guid("000214E3-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IShellView {
            [PreserveSig] int GetWindow(out IntPtr window); [PreserveSig] int ContextSensitiveHelp([MarshalAs(UnmanagedType.Bool)] bool enter);
            [PreserveSig] int TranslateAccelerator(IntPtr message); [PreserveSig] int EnableModeless([MarshalAs(UnmanagedType.Bool)] bool enable);
            [PreserveSig] int UIActivate(uint state); [PreserveSig] int Refresh();
            [PreserveSig] int CreateViewWindow(IntPtr previous, IntPtr settings, IntPtr shellBrowser, IntPtr rect, out IntPtr window);
            [PreserveSig] int DestroyViewWindow(); [PreserveSig] int GetCurrentInfo(IntPtr settings);
            [PreserveSig] int AddPropertySheetPages(uint reserved, IntPtr callback, IntPtr parameter);
            [PreserveSig] int SaveViewState(); [PreserveSig] int SelectItem(IntPtr pidl, uint flags);
            [PreserveSig] int GetItemObject(uint flags, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out ComData data);
        }
        [ComImport, Guid("B63EA76D-1F85-456F-A19C-48159EFA858B"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IShellItemArray {
            void BindToHandler(IntPtr context, ref Guid handler, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out ComData data);
        }
        [DllImport("ole32.dll")] static extern int OleInitialize(IntPtr reserved); [DllImport("ole32.dll")] static extern void OleUninitialize();
        [DllImport("shell32.dll", CharSet = CharSet.Unicode)] static extern int SHParseDisplayName(string name, IntPtr context, out IntPtr pidl, uint input, out uint attributes);
        [DllImport("shell32.dll")] static extern int SHCreateShellItemArrayFromIDLists(uint count, [In] IntPtr[] pidls, out IShellItemArray items);
        [DllImport("shell32.dll", CharSet = CharSet.Unicode)] static extern uint DragQueryFile(IntPtr drop, uint index, StringBuilder name, uint size);
        [DllImport("ole32.dll")] static extern void ReleaseStgMedium(ref STGMEDIUM medium);
    }
}
