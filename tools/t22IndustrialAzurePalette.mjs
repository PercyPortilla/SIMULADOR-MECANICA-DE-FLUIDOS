/**
 * One-time, reproducible palette migration for the workbench CSS only.
 * Never processes Babylon, model assets, renderer code, native Euler panels,
 * simulation / solver state or signed GLB materials.
 *
 * Explicitly retains semantic danger/warning/validation colors. All other
 * decorative greens, ivory backgrounds and copper accents become a coherent
 * industrial steel-blue palette with cyan accents.
 * Run once in an isolated worktree; git diff should be reviewed before commit.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const inputs = ['src/ui/workbenchTransform.css', 'src/ui/threeDWorkbench.css'];
const colors = new Map(Object.entries({
  '#ffffff': '#ffffff', '#fff': '#fff', '#000': '#000',
  '#f3f2ee': '#eef3fa', '#f4f5f1': '#eef3fa', '#f5f6f4': '#f5f8fd',
  '#f7f8f2': '#f5f9ff', '#fbfcf8': '#f8fbff', '#f9faf6': '#f7faff',
  '#162628': '#0c1c36', '#214143': '#123c70', '#214344': '#133c70',
  '#1f4040': '#0e3568', '#1a3334': '#0e2c52', '#233f42': '#135fab',
  '#254746': '#12589c', '#203739': '#173552', '#1d3436': '#173553',
  '#345451': '#174678', '#395d54': '#17548d', '#213638': '#192f4c',
  '#25383a': '#203b5e', '#223639': '#142c4c', '#27383b': '#1b3655',
  '#ba7148': '#1672c9', '#a45c37': '#125ca7', '#ad7155': '#147dcc',
  '#b17c62': '#23a3d8', '#a97054': '#1579cd', '#b87c58': '#1980ca',
  '#c6794f': '#29bbef', '#d2b296': '#5acbff',
  '#2d766f': '#1879d2', '#c17c53': '#7b65d8', '#7d9c9a': '#39b6d6',
  '#29746b': '#1777c9', '#bd7a52': '#7c67d5', '#8aa9aa': '#52b9d9',
  '#2d8668': '#008fa5', '#c46a45': '#c56843', '#bb744e': '#a87532',
  '#b87551': '#b47b42', '#ba7b54': '#be8c51', '#c25750': '#c25750',
  '#fff2ee': '#fff2f0', '#8e4233': '#9f4447',
  '#fbf4ed': '#fff6e7', '#79563a': '#76502e',
  '#e6b49c': '#e6b49c', '#f7dabe': '#f7dabe',
  '#d9b491': '#d9b491', '#8b4e26': '#8b4e26',
  '#317e69': '#148982', '#4e8c73': '#268cbb',
  '#93c6ad': '#62b5d7', '#327c6b': '#1688be',
}));

function hexToHsl(hex) {
  const vals = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255);
  const max=Math.max(...vals),min=Math.min(...vals),d=max-min;
  let h=0,s=0,l=(max+min)/2;
  if (d) {
    s=d/(1-Math.abs(2*l-1));
    switch(max) {
      case vals[0]:h=((vals[1]-vals[2])/d)%6;break;
      case vals[1]:h=(vals[2]-vals[0])/d+2;break;
      default:h=(vals[0]-vals[1])/d+4;
    }
    h=((h*60)%360+360)%360;
  }
  return {h,s,l};
}

function hslToHex(h,s,l) {
  const k=n=>(n+h/30)%12;
  const a=s*Math.min(l,1-l);
  const c=n=>l-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1));
  return '#'+[c(0),c(8),c(4)].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
}

function cooler(hex) {
  const canonical=hex.toLowerCase();
  if (colors.has(canonical)) return colors.get(canonical);
  if (!/^#[a-f0-9]{6}$/.test(canonical)) return hex;
  const {h,s,l}=hexToHsl(canonical);
  // Tinted neutrals should look like steel / ice, never cream or sage.
  if (l>.92) return hslToHex(214,.48,Math.min(.985,l+.014));
  if (l>.82) return hslToHex(215,.36,Math.min(.94,l+.025));
  if (l>.65) return hslToHex(215,.31,l+.012);
  if (l>.43) {
    const accent=(h<65||h>340)&&s>.18;
    return hslToHex(accent?204:211,accent?.67:.27,accent?Math.max(.43,l-.015):l);
  }
  if (l>.24) return hslToHex(213,.44,Math.max(.28,l));
  return hslToHex(215,.49,Math.max(.105,l));
}

for (const file of inputs) {
  let source=readFileSync(file,'utf8');
  if (source.includes('T22_INDUSTRIAL_AZURE_APPLIED')) {
    console.log(`T22_PALETTE_ALREADY_APPLIED ${file}`);
    continue;
  }
  source=source.replace(/#[0-9a-fA-F]{3,8}\b/g,(candidate)=>cooler(candidate));
  // Only color literals, not any numeric geometry / position / spacing.
  source=source.replaceAll('rgba(250, 250, 247, .96)','rgba(248, 251, 255, .97)');
  source=source.replaceAll('rgba(13, 31, 32, .45)','rgba(10, 25, 48, .47)');
  source=source.replaceAll('rgba(33, 51, 43, .028)','rgba(22, 61, 113, .038)');
  writeFileSync(file,'/* T22_INDUSTRIAL_AZURE_APPLIED · Workbench palette only */\n'+source);
  console.log(`T22_PALETTE_UPDATED ${file}`);
}
