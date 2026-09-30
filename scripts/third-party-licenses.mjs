// Writes public/THIRD_PARTY_LICENSES.txt: the license texts of the
// third-party packages that ship to players (their code or generated CSS is
// in the built game). Build-only tools aren't listed. Run after upgrading
// dependencies:  npm run licenses
import fs from 'node:fs';

const SHIPPED = [
  ['react', 'the user interface library'],
  ['react-dom', 'renders the interface in the browser'],
  ['scheduler', 'used internally by react-dom'],
  ['lucide-react', 'icons'],
  ['tailwindcss', 'generates the page styles']
];

let out = 'Penrogo includes the following third-party software, distributed under\nthe licenses below.\n\n';
for (const [name, why] of SHIPPED) {
  const dir = `node_modules/${name}`;
  const pkg = JSON.parse(fs.readFileSync(`${dir}/package.json`, 'utf8'));
  const file = fs.readdirSync(dir).find(f => /^licen[cs]e/i.test(f));
  if (!file) throw new Error(`${name} has no license file`);
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url || pkg.homepage || '';
  out += '='.repeat(78) + '\n';
  out += `${name} ${pkg.version} (${why})\nLicense: ${pkg.license}\n`;
  if (repo) out += `Source: ${repo.replace(/^git\+/, '').replace(/\.git$/, '')}\n`;
  out += '-'.repeat(78) + '\n\n' + fs.readFileSync(`${dir}/${file}`, 'utf8').trim() + '\n\n';
}
fs.writeFileSync('public/THIRD_PARTY_LICENSES.txt', out);
console.log(`Wrote public/THIRD_PARTY_LICENSES.txt (${SHIPPED.length} packages)`);
