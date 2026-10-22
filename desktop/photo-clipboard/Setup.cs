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
            var form = new Form { Text = "CY 사진 전체 복사 설치 · 1.0.0", ClientSize = new Size(520, 280), FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false, StartPosition = FormStartPosition.CenterScreen };
            form.Controls.Add(new Label { Text = "사이트에서 신분증 사진을 각각 저장하고 전체 파일을 복사합니다.\r\n\r\n• 저장 위치: 다운로드 폴더 안 CY_신분증_사진\r\n• Windows 로그인 시 자동 실행 / 알림 영역에서 종료 가능\r\n• cyee-9c1e4.web.app에서 이 PC로만 사진을 전달\r\n• 사진을 서버로 보내거나 카카오톡에 자동 전송하지 않습니다.\r\n\r\n설치 후 사이트로 돌아가 저장·전체 복사 버튼을 누르세요.\r\n브라우저가 로컬 네트워크 접근을 물으면 허용해 주세요.", Location = new Point(20, 20), Size = new Size(480, 190) });
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
                    dynamic shortcut = shell.CreateShortcut(Link); shortcut.TargetPath = Exe; shortcut.WorkingDirectory = Folder; shortcut.Description = "신분증 사진 파일 전체 복사"; shortcut.Save();
                    Process.Start(new ProcessStartInfo(Exe) { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden });
                    MessageBox.Show("설치했습니다. 사이트에서 ‘저장하고 전체 복사’를 누르세요.\r\n다음 Windows 로그인부터 자동 실행됩니다.", "CY 사진 전체 복사"); form.Close();
                } catch { MessageBox.Show("설치를 완료하지 못했습니다. 실행 중인 CY 사진 전체 복사를 종료한 뒤 다시 설치해 주세요.", "설치 오류"); }
            };
            remove.Click += delegate {
                if (MessageBox.Show("보조 프로그램과 자동 실행 설정을 제거할까요?\r\n저장한 신분증 사진은 그대로 남습니다.", "제거 확인", MessageBoxButtons.YesNo) != DialogResult.Yes) return;
                try {
                    Stop();
                    using (var key = Registry.CurrentUser.OpenSubKey(RunKey, true)) {
                        if (key != null && (string)key.GetValue("CYPhotoClipboard") == "\"" + Exe + "\"") key.DeleteValue("CYPhotoClipboard", false);
                    }
                    if (File.Exists(Link)) File.Delete(Link);
                    if (File.Exists(Exe)) File.Delete(Exe);
                    if (Directory.Exists(Folder) && Directory.GetFileSystemEntries(Folder).Length == 0) Directory.Delete(Folder, false);
                    MessageBox.Show("보조 프로그램을 제거했습니다. 저장한 사진은 다운로드 폴더에서 직접 관리해 주세요."); form.Close();
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
