"""Refresh browser-ready data and the optional single-file copy; the root site needs no build."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
data = (root / 'data/model-data.json').read_text(encoding='utf-8')  # Read the prepared numeric classroom examples.
(root / 'model-data.js').write_text('const MODEL_DATA = ' + data + ';\n', encoding='utf-8')  # Load data without a fetch or server.
html = (root / 'index.html').read_text(encoding='utf-8')  # The root HTML is now the editable site itself.
html = html.replace('<link rel="stylesheet" href="./styles.css">', '<style>' + (root / 'styles.css').read_text(encoding='utf-8') + '</style>')  # Inline styles only in the optional standalone copy.
for name in ['model-data.js', 'math.js', 'app.js']:  # Preserve script order when making the standalone copy.
    html = html.replace(f'<script src="./{name}"></script>', '<script>' + (root / name).read_text(encoding='utf-8') + '</script>')
(root / 'dist').mkdir(exist_ok=True)  # Retain the older single-file download and local links.
(root / 'dist/index.html').write_text(html, encoding='utf-8')  # Do not overwrite the editable root page.
for destination in [root, root / 'dist']:  # Both entry points can be served as plain static files.
    (destination / '.nojekyll').write_text('', encoding='utf-8')
print('Refreshed root model-data.js and optional dist/index.html. The root HTML, CSS, and JavaScript are served directly.')
