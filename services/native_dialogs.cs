using System;
using System.IO;
using System.Text;
using System.Windows.Forms;
using System.Runtime.InteropServices;

namespace RedditDesktopDialogs
{
    class Program
    {
        [DllImport("shell32.dll", SetLastError = true)]
        private static extern int SHCreateItemFromParsingName(
            [MarshalAs(UnmanagedType.LPWStr)] string pszPath,
            IntPtr pbc,
            [In, MarshalAs(UnmanagedType.LPStruct)] Guid riid,
            out IShellItem ppv);

        [ComImport]
        [Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")]
        [CoClass(typeof(FileOpenDialogRCW))]
        public interface NativeFileOpenDialog : IFileOpenDialog {}

        [ComImport]
        [Guid("d57c72d1-a424-490c-9624-954990d22732")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IFileOpenDialog
        {
            [PreserveSig] int Show(IntPtr parent);
            void SetFileTypes(uint cFileTypes, IntPtr rgFilterSpec);
            void SetFileTypeIndex(uint iFileType);
            void GetFileTypeIndex(out uint piFileType);
            void Advise(IntPtr pfde, out uint pdwCookie);
            void Unadvise(uint dwCookie);
            void SetOptions(uint fos);
            void GetOptions(out uint pfos);
            void SetDefaultFolder(IShellItem psi);
            void SetFolder(IShellItem psi);
            void GetFolder(out IShellItem ppsi);
            void GetCurrentSelection(out IShellItem ppsi);
            void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string pszName);
            void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string pszName);
            void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string pszTitle);
            void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string pszText);
            void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string pszLabel);
            void GetResult(out IShellItem ppsi);
            void AddPlace(IShellItem psi, int fdap);
            void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string pszDefaultExtension);
            void Close(int hr);
            void SetClientGuid([In, MarshalAs(UnmanagedType.LPStruct)] Guid guid);
            void ClearClientData();
            void SetFilter(IntPtr pFilter);
            void GetResults(out IntPtr ppenum);
            void GetSelectedItems(out IntPtr ppsai);
        }

        [ComImport]
        [Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IShellItem
        {
            void BindToHandler(IntPtr pbc, [In, MarshalAs(UnmanagedType.LPStruct)] Guid bhid, [In, MarshalAs(UnmanagedType.LPStruct)] Guid riid, out IntPtr ppv);
            void GetParent(out IShellItem ppsi);
            void GetDisplayName(uint sigdnName, [MarshalAs(UnmanagedType.LPWStr)] out string ppszName);
            void GetAttributes(uint sfgaoMask, out uint psfgaoAttribs);
            void Compare(IShellItem psi, uint hint, out int piOrder);
        }

        [ComImport]
        [Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")]
        [ClassInterface(ClassInterfaceType.None)]
        [TypeLibType(TypeLibTypeFlags.FCanCreate)]
        public class FileOpenDialogRCW {}

        [STAThread]
        static void Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            if (args.Length == 0)
            {
                return;
            }

            string mode = args[0].ToLowerInvariant();
            string title = args.Length > 1 ? args[1] : "";
            string initialPath = args.Length > 2 ? args[2] : "";

            try
            {
                switch (mode)
                {
                    case "folder":
                        ChooseFolder(title, initialPath);
                        break;
                    case "videos":
                    case "files":
                        ChooseVideos(title, initialPath);
                        break;
                    case "image":
                        ChooseImage(title, initialPath);
                        break;
                    case "audio":
                        ChooseAudio(title, initialPath);
                        break;
                    case "save":
                    case "save-template":
                        SaveTemplate(title, initialPath);
                        break;
                    default:
                        break;
                }
            }
            catch (Exception ex)
            {
                // Fallback silencioso
            }
        }

        static void ChooseFolder(string title, string initialPath)
        {
            try
            {
                var dialog = new NativeFileOpenDialog();
                // FOS_PICKFOLDERS = 0x20, FOS_FORCEFILESYSTEM = 0x40
                dialog.SetOptions(0x20 | 0x40);
                if (!string.IsNullOrEmpty(title))
                {
                    dialog.SetTitle(title);
                }
                else
                {
                    dialog.SetTitle("Selecciona la carpeta");
                }

                if (!string.IsNullOrEmpty(initialPath) && Directory.Exists(initialPath))
                {
                    IShellItem item;
                    Guid iid = new Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE");
                    if (SHCreateItemFromParsingName(initialPath, IntPtr.Zero, iid, out item) == 0 && item != null)
                    {
                        dialog.SetFolder(item);
                    }
                }

                int hr = dialog.Show(IntPtr.Zero);
                if (hr == 0)
                {
                    IShellItem result;
                    dialog.GetResult(out result);
                    if (result != null)
                    {
                        string path;
                        result.GetDisplayName(0x80058000, out path); // SIGDN_FILESYSPATH
                        if (!string.IsNullOrEmpty(path))
                        {
                            Console.WriteLine(path);
                        }
                    }
                }
            }
            catch
            {
                // Fallback a FolderBrowserDialog estándar si COM fallara
                using (var fbd = new FolderBrowserDialog())
                {
                    fbd.Description = string.IsNullOrEmpty(title) ? "Selecciona la carpeta" : title;
                    fbd.ShowNewFolderButton = true;
                    if (!string.IsNullOrEmpty(initialPath) && Directory.Exists(initialPath))
                    {
                        fbd.SelectedPath = initialPath;
                    }
                    if (fbd.ShowDialog() == DialogResult.OK)
                    {
                        Console.WriteLine(fbd.SelectedPath);
                    }
                }
            }
        }

        static void ChooseVideos(string title, string initialPath)
        {
            using (var ofd = new OpenFileDialog())
            {
                ofd.Title = string.IsNullOrEmpty(title) ? "Selecciona tus videos de fondo" : title;
                ofd.Filter = "Archivos de Video (*.mp4;*.mkv;*.mov;*.avi;*.webm)|*.mp4;*.mkv;*.mov;*.avi;*.webm|Todos los archivos (*.*)|*.*";
                ofd.Multiselect = true;
                ofd.AutoUpgradeEnabled = true;
                if (!string.IsNullOrEmpty(initialPath) && Directory.Exists(initialPath))
                {
                    ofd.InitialDirectory = initialPath;
                }
                if (ofd.ShowDialog() == DialogResult.OK)
                {
                    Console.WriteLine(string.Join(";", ofd.FileNames));
                }
            }
        }

        static void ChooseImage(string title, string initialPath)
        {
            using (var ofd = new OpenFileDialog())
            {
                ofd.Title = string.IsNullOrEmpty(title) ? "Selecciona una imagen" : title;
                ofd.Filter = "Imágenes (*.png;*.jpg;*.jpeg;*.webp;*.gif;*.bmp;*.svg)|*.png;*.jpg;*.jpeg;*.webp;*.gif;*.bmp;*.svg|Todos los archivos (*.*)|*.*";
                ofd.Multiselect = false;
                ofd.AutoUpgradeEnabled = true;
                if (!string.IsNullOrEmpty(initialPath) && Directory.Exists(initialPath))
                {
                    ofd.InitialDirectory = initialPath;
                }
                if (ofd.ShowDialog() == DialogResult.OK)
                {
                    Console.WriteLine(ofd.FileName);
                }
            }
        }

        static void ChooseAudio(string title, string initialPath)
        {
            using (var ofd = new OpenFileDialog())
            {
                ofd.Title = string.IsNullOrEmpty(title) ? "Selecciona música de fondo" : title;
                ofd.Filter = "Archivos de Audio (*.mp3;*.wav;*.m4a;*.ogg;*.aac)|*.mp3;*.wav;*.m4a;*.ogg;*.aac|Todos los archivos (*.*)|*.*";
                ofd.Multiselect = false;
                ofd.AutoUpgradeEnabled = true;
                if (!string.IsNullOrEmpty(initialPath) && Directory.Exists(initialPath))
                {
                    ofd.InitialDirectory = initialPath;
                }
                if (ofd.ShowDialog() == DialogResult.OK)
                {
                    Console.WriteLine(ofd.FileName);
                }
            }
        }

        static void SaveTemplate(string title, string defaultFileName)
        {
            using (var sfd = new SaveFileDialog())
            {
                sfd.Title = string.IsNullOrEmpty(title) ? "Guardar Plantilla de Video" : title;
                sfd.Filter = "Plantilla de Video JSON (*.json)|*.json|Todos los archivos (*.*)|*.*";
                sfd.DefaultExt = "json";
                sfd.AddExtension = true;
                sfd.FileName = string.IsNullOrEmpty(defaultFileName) ? "plantilla_template.json" : defaultFileName;
                sfd.AutoUpgradeEnabled = true;
                if (sfd.ShowDialog() == DialogResult.OK)
                {
                    Console.WriteLine(sfd.FileName);
                }
            }
        }
    }
}
