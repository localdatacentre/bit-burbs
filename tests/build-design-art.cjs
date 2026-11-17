'use strict';
const fs=require('node:fs'),path=require('node:path'),{html,extract}=require('./economy-audit-harness.cjs');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
const nav=html.slice(html.indexOf('<nav id='),html.indexOf('</nav>',html.indexOf('<nav id=')));
const dock=Object.fromEntries([...nav.matchAll(/data-open="([^"]+)"[\s\S]*?src="(data:image[^"]+)"/g)].map(m=>[m[1],m[2]]));
const code=scripts[4][1]+'\nwindow.BBModels=SPRK;\n'+html.slice(html.indexOf('const PX_PAL'),html.indexOf('function pixDraw')+extract('pixDraw').length)+'\nwindow.BBIcons={pixImg,chestPix,pixDraw,crateDesigns};\nwindow.BBDockIcons='+JSON.stringify(dock)+';\n';
fs.writeFileSync(path.join(__dirname,'../docs/bit-burbs-art.js'),code);
console.log('Extracted live renderer, pixel icons and dock icons: '+Object.keys(dock).join(', '));
