using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace CyPhotoClipboard {
    static class Program {
        static string SaveRoot() {
            return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CY", "PhotoClipboard", "Cache");
        }
        [STAThread] static void Main() {
            bool created;
            using (var mutex = new Mutex(true, "Local\\CYPhotoClipboard", out created)) {
                if (!created) return;
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                try { using (var context = new Tray(SaveRoot())) Application.Run(context); }
                catch { MessageBox.Show("보조 프로그램을 시작하지 못했습니다. 다른 보조 프로그램이 실행 중인지 확인한 뒤 다시 실행해 주세요.", "CY 사진 전체 복사", MessageBoxButtons.OK, MessageBoxIcon.Error); }
            }
        }
        sealed class Tray : ApplicationContext {
            readonly NotifyIcon icon;
            readonly Control dispatcher = new Control();
            readonly Bridge bridge;
            readonly ShellPhotoWindows photoWindows;
            readonly EventWaitHandle stop;
            readonly RegisteredWaitHandle stopWait;
            readonly System.Windows.Forms.Timer cleanup;
            public Tray(string root) {
                var handle = dispatcher.Handle;
                photoWindows = new ShellPhotoWindows(dispatcher, root);
                bridge = new Bridge(root, NativeClipboard.Copy, Bridge.Port, photoWindows.Open);
                bridge.Start();
                TemporaryPhotos.Prune(root, DateTime.UtcNow, UsesFolder);
                cleanup = new System.Windows.Forms.Timer { Interval = 15 * 60 * 1000 };
                cleanup.Tick += delegate { TemporaryPhotos.Prune(root, DateTime.UtcNow, UsesFolder); };
                cleanup.Start();
                var menu = new ContextMenuStrip();
                menu.Items.Add("임시 사진 확인", null, delegate {
                    Directory.CreateDirectory(root);
                    Process.Start(new ProcessStartInfo(root) { UseShellExecute = true });
                });
                menu.Items.Add("마지막 사진 전체 다시 복사", null, delegate {
                    bool copied = bridge.CopyLast();
                    MessageBox.Show(copied ? "사진 파일을 모두 복사했습니다. 카카오톡에서 붙여넣기가 안 되면 사이트의 ‘한 번에 끌어놓기’를 이용하세요." : "복사할 사진이 없거나 클립보드를 사용할 수 없습니다. 사이트에서 다시 전체 복사를 눌러 주세요.", "CY 사진 전체 복사");
                });
                menu.Items.Add("종료", null, delegate { ExitThread(); });
                icon = new NotifyIcon { Icon = SystemIcons.Application, Text = "CY 사진 전체 복사", ContextMenuStrip = menu, Visible = true };
                stop = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\CYPhotoClipboardStop");
                stopWait = ThreadPool.RegisterWaitForSingleObject(stop, delegate { dispatcher.BeginInvoke((Action)ExitThread); }, null, Timeout.Infinite, true);
            }
            bool UsesFolder(string folder) { return photoWindows.UsesFolder(folder) || NativeClipboard.UsesFolder(folder); }
            protected override void Dispose(bool disposing) {
                if (disposing) { cleanup.Dispose(); bridge.Dispose(); photoWindows.Dispose(); stopWait.Unregister(null); stop.Dispose(); NativeClipboard.Shutdown(); icon.Visible = false; icon.Dispose(); dispatcher.Dispose(); }
                base.Dispose(disposing);
            }
        }
    }
}
