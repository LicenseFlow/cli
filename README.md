# LicenseFlow CLI

Command-line tool for managing LicenseFlow licenses, activations, and hardware fingerprints.

## Installation

### Via npm (recommended)
```bash
npm install -g @licenseflow/cli

# Or use with npx
npx @licenseflow/cli --help
```

### Standalone Binaries
Download from [releases](https://github.com/licenseflow/licenseflow-cli/releases):
- `licenseflow-win.exe` - Windows x64
- `licenseflow-macos` - macOS x64
- `licenseflow-linux` - Linux x64

## Quick Start

```bash
# Configure your API key (optional, for authenticated endpoints)
licenseflow config set apiKey YOUR_API_KEY

# Validate a license
licenseflow validate LICENSE-KEY-HERE

# Activate on this machine
licenseflow activate LICENSE-KEY-HERE --save

# Check status
licenseflow status
```

## Commands

### `licenseflow activate [license-key]`
Activate a license on this machine.

```bash
# Basic activation
licenseflow activate ABC-123-XYZ

# With full hardware fingerprint
licenseflow activate ABC-123-XYZ --full-fingerprint

# Save to config for future use
licenseflow activate ABC-123-XYZ --save

# Custom device name
licenseflow activate ABC-123-XYZ -n "Build Server 01"
```

### `licenseflow deactivate [license-key]`
Deactivate a license from this machine.

```bash
licenseflow deactivate
licenseflow deactivate ABC-123-XYZ --clear-config
```

### `licenseflow validate [license-key]`
Validate a license key.

```bash
# Standard validation
licenseflow validate ABC-123-XYZ

# JSON output
licenseflow validate ABC-123-XYZ --json

# Quiet mode (for scripts)
licenseflow validate ABC-123-XYZ -q && echo "Valid!"
```

### `licenseflow checkout [license-key]`
Checkout a temporary license lease for CI/CD pipelines.

```bash
# Checkout for 2 hours (default)
licenseflow checkout ABC-123-XYZ -r "github-job-12345"

# Custom duration (in seconds)
licenseflow checkout ABC-123-XYZ -r "gitlab-runner-1" -t 3600

# With metadata
licenseflow checkout ABC-123-XYZ -r "ci-job" --pipeline main --branch release/v2.0
```

### `licenseflow checkin [lease-key]`
Release a license lease when done.

```bash
# Uses saved lease key
licenseflow checkin

# Explicit lease key
licenseflow checkin LCK-XXXX-XXXX
```

### `licenseflow status`
Check status of license or lease.

```bash
# Check saved license
licenseflow status

# Check specific lease
licenseflow status --lease LCK-XXXX-XXXX

# Check specific license
licenseflow status --license ABC-123-XYZ
```

### `licenseflow fingerprint`
Generate hardware fingerprint for this machine.

```bash
# Full fingerprint
licenseflow fingerprint

# Simple device ID only (faster)
licenseflow fingerprint --simple

# JSON output
licenseflow fingerprint --json

# Specific components only
licenseflow fingerprint --components cpu,gpu,network
```

### `licenseflow config`
Manage CLI configuration.

```bash
# Show current config
licenseflow config show

# Set values
licenseflow config set apiKey YOUR_KEY
licenseflow config set licenseKey ABC-123-XYZ
licenseflow config set apiEndpoint https://your-instance.supabase.co/functions/v1

# Get a value
licenseflow config get apiEndpoint

# Clear all config
licenseflow config clear --force

# Show config file location
licenseflow config path
```

## CI/CD Integration

### GitHub Actions
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install LicenseFlow CLI
        run: npm install -g @licenseflow/cli
      
      - name: Checkout License
        id: license
        run: |
          licenseflow checkout ${{ secrets.LICENSE_KEY }} \
            -r "github-${{ github.run_id }}" \
            --pipeline "${{ github.workflow }}" \
            --branch "${{ github.ref_name }}"
      
      - name: Build
        run: npm run build
      
      - name: Release License
        if: always()
        run: licenseflow checkin
```

### GitLab CI
```yaml
build:
  script:
    - npm install -g @licenseflow/cli
    - licenseflow checkout $LICENSE_KEY -r "gitlab-$CI_JOB_ID" -t 7200
    - npm run build
  after_script:
    - licenseflow checkin
```

## Hardware Fingerprinting

The CLI collects the following hardware identifiers for device binding:

| Component | Data Collected |
|-----------|---------------|
| **CPU** | Manufacturer, model, core count, speed |
| **GPU** | Vendor, model, VRAM |
| **Network** | MAC addresses (physical interfaces only) |
| **Disk** | Type, size, serial numbers |
| **Motherboard** | Manufacturer, model, serial |
| **OS** | Platform, version, architecture, hostname |
| **BIOS** | Vendor, version, release date |
| **System** | Manufacturer, model, serial, UUID |

The device ID is a SHA-256 hash of key identifiers (CPU + MAC + system UUID + motherboard serial).

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error or invalid license |

Use exit codes in scripts:
```bash
if licenseflow validate $KEY -q; then
  echo "License valid"
else
  echo "License invalid"
  exit 1
fi
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `LICENSEFLOW_API_KEY` | API key (alternative to config) |
| `LICENSEFLOW_ENDPOINT` | API endpoint override |
| `CI` | Detected by checkout command |
| `GITHUB_RUN_ID` | Added to checkout metadata |
| `CI_JOB_ID` | Added to checkout metadata (GitLab) |

## Building from Source

```bash
# Clone and install
git clone https://github.com/licenseflow/licenseflow-cli
cd licenseflow-cli
npm install

# Development
npm run dev -- validate KEY

# Build
npm run build

# Create standalone binaries
npm run pkg:all
```

## License

MIT
