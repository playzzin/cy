using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace CyPhotoClipboard {
    static class Setup {
        static readonly string Folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CY", "PhotoClipboard");
        static readonly string Exe = Path.Combine(Folder, "CYPhotoClipboard.exe");
        static readonly string Link = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "CY 사진 전체 복사.lnk");
        const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
        [STAThread] static void Main() {
            Application.EnableVisualStyles();
            Application.Run(CreateForm());
        }
        internal static Form CreateForm() {
            var form = new Form { Text = "CY 사진 첨부·복사 설치 · 1.3.0", ClientSize = new Size(540, 300), FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false, StartPosition = FormStartPosition.CenterScreen };
            form.Controls.Add(new Label { Text = "Windows 사진창에서 여러 원본 사진을 한 번에 끌어놓습니다.\r\n\r\n• 사진창의 선택된 사진 하나를 카카오톡 대화창으로 끌어놓기\r\n• 저장 위치 선택 없이 보조 프로그램이 임시 사진 관리\r\n• 24시간 지난 사진은 사진창·클립보드에서 사용하지 않을 때 정리\r\n• Windows 로그인 시 자동 실행 / 알림 영역에서 종료 가능\r\n• 첨부 미리보기와 전송은 사용자가 카카오톡에서 확인\r\n\r\n설치 후 사이트에서 ‘사진 N장 한 번에 끌어놓기’를 누르세요.\r\n브라우저가 로컬 네트워크 접근을 물으면 허용해 주세요.", Location = new Point(20, 20), Size = new Size(500, 190) });
            var install = new Button { Text = "설치하고 실행", Location = new Point(20, 225), Size = new Size(180, 35) };
            var remove = new Button { Text = "보조 프로그램 제거", Location = new Point(215, 225), Size = new Size(180, 35), Enabled = File.Exists(Exe) };
            form.Controls.Add(install); form.Controls.Add(remove);
            install.Click += delegate {
                try {
                    Stop(); Directory.CreateDirectory(Folder);
                    using (var source = Assembly.GetExecutingAssembly().GetManifestResourceStream("Helper"))
                    using (var target = new FileStream(Exe, FileMode.Create, FileAccess.Write)) source.CopyTo(target);
                    using (var key = Registry.CurrentUser.CreateSubKey(RunKey)) key.SetValue("CYPhotoClipboard", "\"" + Exe + "\"");
                    dynamic shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
                    dynamic shortcut = shell.CreateShortcut(Link); shortcut.TargetPath = Exe; shortcut.WorkingDirectory = Folder; shortcut.Description = "신분증 사진 여러 장 끌어놓기와 전체 복사"; shortcut.Save();
                    Process.Start(new ProcessStartInfo(Exe) { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden });
                    MessageBox.Show("설치했습니다. 사이트를 새로고침하고 ‘사진 N장 한 번에 끌어놓기’를 누르세요.\r\n열린 사진창에서 사진들을 카카오톡으로 끌어놓으면 됩니다.", "CY 사진 첨부·복사"); form.Close();
                } catch { MessageBox.Show("설치를 완료하지 못했습니다. 실행 중인 CY 사진 전체 복사를 종료한 뒤 다시 설치해 주세요.", "설치 오류"); }
            };
            remove.Click += delegate {
                if (MessageBox.Show("보조 프로그램과 자동 실행 설정을 제거할까요?\r\n기존 다운로드 사진과 임시 폴더는 그대로 남습니다.", "제거 확인", MessageBoxButtons.YesNo) != DialogResult.Yes) return;
                try {
                    Stop();
                    using (var key = Registry.CurrentUser.OpenSubKey(RunKey, true)) {
                        if (key != null && (string)key.GetValue("CYPhotoClipboard") == "\"" + Exe + "\"") key.DeleteValue("CYPhotoClipboard", false);
                    }
                    if (File.Exists(Link)) File.Delete(Link);
                    if (File.Exists(Exe)) File.Delete(Exe);
                    if (Directory.Exists(Folder) && Directory.GetFileSystemEntries(Folder).Length == 0) Directory.Delete(Folder, false);
                    MessageBox.Show("보조 프로그램을 제거했습니다. 기존에 저장한 사진은 삭제하지 않았습니다."); form.Close();
                } catch { MessageBox.Show("제거를 완료하지 못했습니다. 보조 프로그램을 종료하고 다시 실행해 주세요."); }
            };
            return form;
        }
        static void Stop() {
            try { using (var signal = EventWaitHandle.OpenExisting("Local\\CYPhotoClipboardStop")) signal.Set(); } catch (WaitHandleCannotBeOpenedException) { }
            // Wait only for this helper's mutex; never terminate other applications.
            using (var mutex = new Mutex(false, "Local\\CYPhotoClipboard")) {
                bool acquired = false;
                try { try { acquired = mutex.WaitOne(5000); } catch (AbandonedMutexException) { acquired = true; } if (!acquired) throw new IOException(); }
                finally { if (acquired) mutex.ReleaseMutex(); }
            }
        }
    }
}
