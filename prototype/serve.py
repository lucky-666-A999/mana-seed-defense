import http.server
import os
import sys


# 브라우저 캐시 때문에 수정한 모듈/JSON이 안 바뀌어 보이는 문제 방지
class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8124
    print(f"마나시드 디펜스 서버: http://localhost:{port}/index.html")
    http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
