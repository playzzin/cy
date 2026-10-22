using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Windows.Forms;

namespace CyPhotoClipboard {
    static class SetupPreview {
        // Separate, non-shipped visual test. Never clicks install or modifies the registry.
        [STAThread] static void Main(string[] args) {
            Application.EnableVisualStyles();
            using (var form = Setup.CreateForm())
            using (var bitmap = new Bitmap(form.Width, form.Height)) {
                form.DrawToBitmap(bitmap, new Rectangle(0, 0, form.Width, form.Height));
                bitmap.Save(args[0], ImageFormat.Png);
            }
        }
    }
}
