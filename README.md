[![NPM Version](https://img.shields.io/npm/v/%40sie-js%2Fswilib-tools)](https://www.npmjs.com/package/@sie-js/swilib-tools)

# Summary

A command-line utility for working with swilib and patterns.

Supported on all major operating systems: Linux, macOS, and Windows.

# Install

### macOS & Linux
1. Install the latest version of [Node.js](https://nodejs.org/en/download/).
2. Install the package:

   ```bash
   npm install -g @sie-js/swilib-tools@latest
   ```

### Windows
1. Find and install the USB drivers for your phone.
2. Install scoop: https://scoop.sh/
3. Run in PowerShell:
   ```powershell
   scoop bucket add main
   scoop install main/nodejs
   npm install -g @sie-js/swilib-tools@latest
   ```

### External dependencies
These external tools must be available in your PATH:
- arm-none-eabi-gcc
- git

# Development root
This tool requires some external repositories to work properly.

The default path to the development root is `<HOME>/dev/sie`, `<HOME>/dev/siemens`, or the current working directory.

Otherwise, you can specify any path using the `-R, --root` option.

A simple way to create a development root:
```bash
mkdir -p ~/dev/sie
cd ~/dev/sie
git clone https://github.com/siemens-mobile-hacks/sdk --depth 1
git clone https://github.com/siemens-mobile-hacks/patches --depth 1
```

Also, remember to pull the latest changes from these repositories regularly.

# Usage
```
Usage: swilib-tools [options] [command]

CLI tool for Siemens Mobile phone development.

Options:
  -v, --version                output the version number
  -R, --root                   path to the root directory with the SDK and other repos
  -h, --help                   display help for command

Commands:
  server [options]             API for web frontend
  check [options]              Check swilib.vkp for errors
  merge [options]              Merge two swilib.vkp files (source.vkp → destination.vkp)
  convert [options]            Convert swilib to other formats
  gen-asm-symbols [options]    Generate assembler symbols for the SDK
  gen-simulator-api [options]  Generate API stubs for the elf emulator
  help [command]               display help for command
```
