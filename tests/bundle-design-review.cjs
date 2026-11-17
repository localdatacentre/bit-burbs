'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../docs'),html=fs.readFileSync(path.join(root,'rewards-ui-review.html'),'utf8');
const inline=name=>'<script>'+fs.readFileSync(path.join(root,name),'utf8').replace(/<\/script/gi,'<\\/script')+'</script>';
const bundled=html.replace('<script src="bit-burbs-art.js"></script>',inline('bit-burbs-art.js')).replace('<script src="rewards-ui-review.js"></script>',inline('rewards-ui-review.js'));
fs.writeFileSync(path.join(root,'bit-burbs-rewards-review.html'),bundled);
console.log('Bundled standalone design review: '+Buffer.byteLength(bundled)+' bytes');
