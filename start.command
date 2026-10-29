#!/bin/bash
# Kukja Mario - double-click to view the site on this Mac (first time: right-click > Open).
# Starts a small web server for the "site" folder and opens the browser; close the Terminal
# window (or press Ctrl+C) to stop it. Uses whatever is already on the Mac: Node.js if
# installed, else Python 3, else Ruby, else Perl (always part of macOS). Nothing is installed.
cd "$(dirname "$0")" || exit 1
ROOT="$PWD/site"
[ -f "$ROOT/index.html" ] || ROOT="$PWD"          # the script sits inside the site folder
PORT=8080
while (echo > /dev/tcp/127.0.0.1/$PORT) >/dev/null 2>&1; do PORT=$((PORT + 1)); done
URL="http://localhost:$PORT/"
echo
echo "  Kukja Mario is running at $URL"
echo "  Close this window or press Ctrl+C to stop it."
echo
[ -n "$VA_NO_BROWSER" ] || (sleep 1.5; open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null) &

if command -v node >/dev/null 2>&1; then
  exec node -e '
    const http = require("http"), fs = require("fs"), path = require("path");
    const root = path.resolve(process.argv[1]), port = Number(process.argv[2]);
    const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
      ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ktx2": "image/ktx2", ".glb": "model/gltf-binary",
      ".bin": "application/octet-stream", ".wasm": "application/wasm", ".woff2": "font/woff2" };
    http.createServer((req, res) => {
      let p = "/"; try { p = decodeURIComponent(req.url.split(/[?#]/)[0]) || "/"; } catch {}
      if (p.endsWith("/")) p += "index.html";
      const f = path.join(root, p);
      if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
      fs.readFile(f, (e, d) => {
        if (e) { res.writeHead(404); return res.end("not found"); }
        res.writeHead(200, { "Content-Type": T[path.extname(f).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
        res.end(d);
      });
    }).listen(port, "127.0.0.1");' "$ROOT" "$PORT"
fi

# python3 on a Mac without the developer tools is only a stub that asks to install them: skip it
if command -v python3 >/dev/null 2>&1 && { [ "$(command -v python3)" != /usr/bin/python3 ] || xcode-select -p >/dev/null 2>&1; }; then
  exec python3 -c '
import http.server, functools, sys
H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=sys.argv[1])
H.func.extensions_map.update({".js": "text/javascript", ".mjs": "text/javascript", ".ktx2": "image/ktx2", ".glb": "model/gltf-binary", ".wasm": "application/wasm"})
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[2])), H).serve_forever()' "$ROOT" "$PORT"
fi

if command -v ruby >/dev/null 2>&1 && ruby -e 'require "webrick"' >/dev/null 2>&1; then
  exec ruby -e '
require "webrick"
mime = WEBrick::HTTPUtils::DefaultMimeTypes.merge("js" => "text/javascript", "mjs" => "text/javascript", "ktx2" => "image/ktx2", "glb" => "model/gltf-binary", "wasm" => "application/wasm")
s = WEBrick::HTTPServer.new(BindAddress: "127.0.0.1", Port: ARGV[1].to_i, DocumentRoot: ARGV[0], MimeTypes: mime, AccessLog: [], Logger: WEBrick::Log.new(File::NULL))
trap("INT") { s.shutdown }
s.start' "$ROOT" "$PORT"
fi

# Perl is part of every macOS: a minimal one-request-at-a-time server
exec perl -MIO::Socket::INET -e '
my ($root, $port) = @ARGV;
my %T = (html => "text/html; charset=utf-8", js => "text/javascript", mjs => "text/javascript", css => "text/css", json => "application/json",
  svg => "image/svg+xml", png => "image/png", jpg => "image/jpeg", webp => "image/webp", ktx2 => "image/ktx2", glb => "model/gltf-binary",
  bin => "application/octet-stream", wasm => "application/wasm", woff2 => "font/woff2");
my $srv = IO::Socket::INET->new(LocalAddr => "127.0.0.1", LocalPort => $port, Listen => 64, ReuseAddr => 1) or die "port $port: $!\n";
$SIG{PIPE} = "IGNORE";
while (my $c = $srv->accept) {
  my $line = <$c> // next; while (my $h = <$c>) { last if $h =~ /^\r?\n$/ }
  my ($path) = $line =~ m{^GET\s+([^\s?#]*)};
  $path //= "/"; $path =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/ge; $path .= "index.html" if $path =~ m{/$};
  my $f = "$root$path";
  if ($path !~ m{\.\.} && -f $f && open(my $fh, "<:raw", $f)) {
    local $/; my $d = <$fh>; close $fh;
    my ($ext) = $f =~ /\.(\w+)$/; my $t = $T{lc($ext // "")} // "application/octet-stream";
    print $c "HTTP/1.0 200 OK\r\nContent-Type: $t\r\nContent-Length: " . length($d) . "\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n$d";
  } else { print $c "HTTP/1.0 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n" }
  close $c;
}' "$ROOT" "$PORT"
