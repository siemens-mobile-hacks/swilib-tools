# INSTALL
```bash
git clone https://github.com/siemens-mobile-hacks/sdk
git clone https://github.com/siemens-mobile-hacks/patches
git clone https://github.com/siemens-mobile-hacks/swilib-tools

cd swilib-tools
npm install
```

Expected filesystem structure:
```
.
├── patches/        <-- git siemens-mobile-hacks/patches
├── sdk/            <-- git siemens-mobile-hacks/sdk
└── swilib-tools/   <-- git siemens-mobile-hacks/swilib-tools
```

Current architecture uses `sdk` and `patches` from the parent directory.

# USAGE
1. Check local swilib.vkp for errors:
```bash
# You can specify phone model or platform
node bin/swilib-tools.js check EL71v45 path/to/swilib.vkp 
node bin/swilib-tools.js check ELKA path/to/swilib.vkp
```
2. Check swilib.vkp from https://patches.kibab.com
```bash
# Don't forget git pull in patches & sdk repos
node bin/swilib-tools.js check EL71v45
```
3. Merge two swilibs into single one (interactive):
```bash
node bin/swilib-tools.js check C81v51 swilib_a.vkp swilib_b.vkp new_swilib.vjp
```

# HTTP API SERVER
Yout can use [https://pm2.keymetrics.io/](pm2) for process manager.

**Setup:**
```bash
pm2 start ecosystem.config.cjs
pm2 save
```

**Deploy:**
```bash
./deploy.sh
```
