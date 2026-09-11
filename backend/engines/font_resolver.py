"""
Font Resolver & Downloader Module for BlueWhale Printing Assistant.
Queries Google Fonts catalog for open-source font availability, handles download & installation to system fonts,
and detects commercial / proprietary fonts requiring licensing.
"""

import os
import re
import subprocess
import urllib.request
import urllib.parse
import json


class FontResolver:
    """Core helper for resolving missing/unembedded fonts."""

    COMMERCIAL_FONTS = {
        "helvetica", "helveticaneue", "futura", "frutiger", "myriad", "myriadpro",
        "avenir", "garamond", "bodoni", "baskerville", "proximanova", "gotham",
        "din", "tradegothic", "clarendon", "optima", "gill sans", "gillsans",
        "univers", "bembo", "centurygothic", "timesnewroman", "couriernew", "palatino"
    }

    @staticmethod
    def clean_font_name(raw_name: str) -> str:
        """Strips PostScript subset prefixes (e.g. 'ABCDEF+Roboto-Bold' -> 'Roboto')."""
        if not raw_name:
            return "Unknown"
        # Strip PostScript subset tag prefix (6 uppercase letters + '+')
        cleaned = re.sub(r'^[A-Z]{6}\+', '', raw_name)
        # Replace dashes/underscores with space and separate font style suffixes
        cleaned = cleaned.replace('-', ' ').replace('_', ' ')
        # Remove common style descriptors
        cleaned = re.sub(r'\b(Bold|Italic|Regular|Light|Medium|Black|Thin|Condensed|Heavy|Oblique|MT|PS|Roman)\b', '', cleaned, flags=re.IGNORECASE)
        cleaned = cleaned.strip()
        return cleaned if cleaned else raw_name

    @classmethod
    def is_commercial(cls, font_name: str) -> bool:
        """Determines if a font is a known commercial/paid font."""
        clean = cls.clean_font_name(font_name).lower().replace(' ', '')
        return any(c_font in clean for c_font in cls.COMMERCIAL_FONTS)

    @classmethod
    def check_google_fonts(cls, font_name: str) -> dict:
        """Queries Google Fonts API / download link for open source font availability."""
        clean_name = cls.clean_font_name(font_name)
        if cls.is_commercial(clean_name):
            return {
                "font_name": clean_name,
                "raw_name": font_name,
                "is_available": False,
                "is_commercial": True,
                "license": "Commercial / Paid License Required 🔒",
                "message": f"'{clean_name}' is a proprietary commercial font. Embedding or purchasing a press license is required.",
                "download_url": None,
                "search_url": f"https://www.google.com/search?q={urllib.parse.quote(clean_name + ' font license buy')}"
            }

        # Query Google Fonts CSS API for font download endpoint
        encoded_name = urllib.parse.quote(clean_name)
        css_url = f"https://fonts.googleapis.com/css2?family={encoded_name}"
        req = urllib.request.Request(
            css_url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        )

        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                css_content = resp.read().decode("utf-8")
                # Extract ttf/woff2 URL from @font-face src
                match = re.search(r'src:\s*url\((https://[^\)]+)\)', css_content)
                if match:
                    font_file_url = match.group(1)
                    return {
                        "font_name": clean_name,
                        "raw_name": font_name,
                        "is_available": True,
                        "is_commercial": False,
                        "license": "Open Source (SIL OFL / Google Fonts) 🟢",
                        "message": f"'{clean_name}' is available for free open-source download from Google Fonts.",
                        "download_url": font_file_url,
                        "search_url": f"https://fonts.google.com/specimen/{urllib.parse.quote(clean_name)}"
                    }
        except Exception:
            pass

        return {
            "font_name": clean_name,
            "raw_name": font_name,
            "is_available": False,
            "is_commercial": cls.is_commercial(clean_name),
            "license": "Commercial or External License 🔒" if cls.is_commercial(clean_name) else "External Font Source 🌐",
            "message": f"'{clean_name}' was not found in open-source Google Fonts catalog. Please embed font in authoring app.",
            "download_url": None,
            "search_url": f"https://www.google.com/search?q={urllib.parse.quote(clean_name + ' font download')}"
        }

    @staticmethod
    def install_font_from_url(font_name: str, download_url: str) -> tuple[bool, str]:
        """Downloads font file (.ttf / .otf) and installs it for current user on Windows or Linux."""
        try:
            ext = ".ttf" if "ttf" in download_url or ".ttf" in download_url else ".otf"
            clean_filename = f"{font_name.replace(' ', '_')}{ext}"

            # Determine OS specific font directory
            if os.name == "nt":  # Windows
                user_profile = os.environ.get("USERPROFILE", "")
                local_appdata = os.environ.get("LOCALAPPDATA", os.path.join(user_profile, "AppData", "Local"))
                fonts_dir = os.path.join(local_appdata, "Microsoft", "Windows", "Fonts")
            else:  # Linux / Unix
                fonts_dir = os.path.expanduser("~/.local/share/fonts")

            os.makedirs(fonts_dir, exist_ok=True)
            target_path = os.path.join(fonts_dir, clean_filename)

            req = urllib.request.Request(
                download_url,
                headers={"User-Agent": "Mozilla/5.0"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                font_data = resp.read()
                with open(target_path, "wb") as f:
                    f.write(font_data)

            # OS specific font registration
            if os.name == "nt":
                # Register font in Windows Registry for current user
                try:
                    import winreg
                    reg_path = r"Software\Microsoft\Windows NT\CurrentVersion\Fonts"
                    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, reg_path, 0, winreg.KEY_SET_VALUE) as key:
                        font_reg_name = f"{font_name} (TrueType)" if ext == ".ttf" else f"{font_name} (OpenType)"
                        winreg.SetValueEx(key, font_reg_name, 0, winreg.REG_SZ, target_path)

                    # Notify Windows system of font change via GDI AddFontResourceW / WM_FONTCHANGE
                    try:
                        import ctypes
                        ctypes.windll.gdi32.AddFontResourceW(target_path)
                        HWND_BROADCAST = 0xFFFF
                        WM_FONTCHANGE = 0x001D
                        ctypes.windll.user32.SendMessageW(HWND_BROADCAST, WM_FONTCHANGE, 0, 0)
                    except Exception:
                        pass
                except Exception:
                    pass
            else:
                # Trigger Linux font cache refresh
                try:
                    subprocess.run(["fc-cache", "-f"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception:
                    pass

            return True, f"Font '{font_name}' installed successfully to {target_path}!"
        except Exception as e:
            return False, f"Failed to download/install font: {e}"
