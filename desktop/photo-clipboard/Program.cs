using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace CyPhotoClipboard {
    static class Program {
        [DllImport("shell32.dll")] static extern int SHGetKnownFolderPath([MarshalAs(UnmanagedType.LPStruct)] Guid id, uint flags, IntPtr token, out IntPtr path);
        static string SaveRoot() {
            IntPtr pointer;
            int result = SHGetKnownFolderPath(new Guid("374DE290-123F-4565-9164-39C4925E467B"), 0, IntPtr.Zero, out pointer);
            if (result != 0) Marshal.ThrowExceptionForHR(result);
            try { return Path.Combine(Marshal.PtrToStringUni(pointer), "CY_신분증_사진"); } finally { Marshal.FreeCoTaskMem(pointer); }
        }
        [STAThread] static void Main() {
            bool created;
            using (var mutex = new Mutex(true, "Local\\CYPhotoClipboard", out created)) {
                if (!created) return;
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                try { using (var context = new Tray(SaveRoot())) Application.Run(context); }
                catch { MessageBox.Show("보조 프로그램을 시작하지 못했습니다. 다른 보조 프로그램이 실행 중인지, 다운로드 폴더를 사용할 수 있는지 확인해 주세요.", "CY 사진 전체 복사", MessageBoxButtons.OK, MessageBoxIcon.Error); }
            }
        }
        sealed class Tray : ApplicationContext {
            readonly NotifyIcon icon;
            readonly Control dispatcher = new Control();
            readonly Bridge bridge;
            readonly EventWaitHandle stop;
            readonly RegisteredWaitHandle stopWait;
            public Tray(string root) {
                var handle = dispatcher.Handle;
                bridge = new Bridge(root, NativeClipboard.Copy, Bridge.Port);
                bridge.Start();
                var menu = new ContextMenuStrip();
                menu.Items.Add("저장 폴더 열기", null, delegate {
                    Directory.CreateDirectory(root);
                    Process.Start(new ProcessStartInfo(root) { UseShellExecute = true });
                });
                menu.Items.Add("마지막 사진 전체 다시 복사", null, delegate {
                    bool copied = bridge.CopyLast();
                    MessageBox.Show(copied ? "사진 파일을 모두 복사했습니다. 카카오톡 대화 입력칸에서 Ctrl+V를 누르세요." : "복사할 사진이 없거나 파일이 이동됐습니다. 사이트에서 다시 저장·복사해 주세요.", "CY 사진 전체 복사");
                });
                menu.Items.Add("종료", null, delegate { ExitThread(); });
                icon = new NotifyIcon { Icon = SystemIcons.Application, Text = "CY 사진 전체 복사", ContextMenuStrip = menu, Visible = true };
                stop = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\CYPhotoClipboardStop");
                stopWait = ThreadPool.RegisterWaitForSingleObject(stop, delegate { dispatcher.BeginInvoke((Action)ExitThread); }, null, Timeout.Infinite, true);
            }
            protected override void Dispose(bool disposing) {
                if (disposing) { bridge.Dispose(); stopWait.Unregister(null); stop.Dispose(); icon.Visible = false; icon.Dispose(); dispatcher.Dispose(); }
                base.Dispose(disposing);
            }
        }
    }
}
