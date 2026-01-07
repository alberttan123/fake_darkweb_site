import http.server
import socketserver
import webbrowser
import os
import sys

HOST = "127.0.0.1"
PORT = 8000
START_PAGE = "main.html"

def get_base_dir():
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def log_message(self, format, *args):
        pass  # silence logs

def run_server():
    base_dir = get_base_dir()
    os.chdir(base_dir)

    if not os.path.exists(START_PAGE):
        print(f"ERROR: {START_PAGE} not found in:\n{base_dir}")
        input("Press Enter to exit...")
        return

    # Try ports until one works (handles “port already in use”)
    port = PORT
    httpd = None
    while port < PORT + 20:
        try:
            handler = lambda *args, **kwargs: QuietHandler(*args, directory=base_dir, **kwargs)
            httpd = socketserver.TCPServer((HOST, port), handler)
            break
        except OSError:
            port += 1

    if httpd is None:
        print("ERROR: Could not bind to a port (8000-8019).")
        input("Press Enter to exit...")
        return

    url = f"http://{HOST}:{port}/{START_PAGE}"
    print("===================================")
    print(" Local site server is running")
    print("-----------------------------------")
    print(f" Folder: {base_dir}")
    print(f" URL:    {url}")
    print("===================================")
    print("Leave this window open while using the site.")
    print("Close it to stop the server.\n")

    webbrowser.open(url)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()

if __name__ == "__main__":
    run_server()
