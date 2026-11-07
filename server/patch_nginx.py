"""Applique à /etc/nginx/conf.d/xuehanyu_org.conf (idempotent) :
  - la limitation de débit et le proxy de /api/push/ vers le service de rappels,
  - `charset utf-8;` sur www,
  - des redirections 301 (au lieu de 302) de xuehanyu.org vers www : un 302 ne transmet pas
    le « jus » SEO vers l'adresse canonique.
Usage : python3 patch_nginx.py /etc/nginx/conf.d/xuehanyu_org.conf
"""
import sys

path = sys.argv[1]
s = open(path, encoding="utf-8").read()
orig = s

HEAD = """# Rappels push : clé de limitation = vraie IP du visiteur (Cloudflare la passe en CF-Connecting-IP)
map $http_cf_connecting_ip $xh_client_ip {
    default $http_cf_connecting_ip;
    ""      $binary_remote_addr;
}
limit_req_zone $xh_client_ip zone=xh_push:1m rate=30r/m;

"""
LOCATION = """    location /api/push/ {
        limit_req zone=xh_push burst=20 nodelay;
        limit_req_status 429;
        client_max_body_size 8k;
        proxy_pass http://127.0.0.1:3004;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $xh_client_ip;
        proxy_read_timeout 15s;
    }
"""

if "zone=xh_push" not in s:
    s = HEAD + s
if "location /api/push/" not in s:
    marker = "    location / {\n        try_files $uri $uri/ =404;\n    }\n"
    if s.count(marker) != 1:
        sys.exit("bloc `location /` introuvable ou ambigu : rien modifié")
    s = s.replace(marker, LOCATION + marker)
s = s.replace("return 302 https://www.xuehanyu.org$request_uri;", "return 301 https://www.xuehanyu.org$request_uri;")

# En-tête Content-Type avec « charset=utf-8 » (signalé par les audits SEO quand il manque)
if "charset utf-8;" not in s:
    anchor = "    index index.html index.htm;\n"
    if s.count(anchor) != 1:
        sys.exit("ancre `index index.html` introuvable ou ambiguë : rien modifié")
    s = s.replace(anchor, anchor + "    charset utf-8;\n")

if s == orig:
    print("déjà à jour")
else:
    open(path, "w", encoding="utf-8").write(s)
    print("modifié")
