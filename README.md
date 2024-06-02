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
# Update local caches (optional)
node bin/swilib-tools.js update-cache

# Check swilib.vkp from kibab
node bin/swilib-tools.js check EL71v45
```
