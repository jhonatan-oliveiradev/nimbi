# Microsoft Store package

Nimbi's direct debug executable is unsigned and can be blocked by Windows Smart App Control.

For a broadly trusted build without maintaining a separate code-signing certificate, Nimbi can be packaged as MSIX and submitted through Microsoft Store. Microsoft Store re-signs accepted MSIX/AppX submissions with a Microsoft certificate.

## Partner Center values required

Reserve the Nimbi product in Partner Center and copy these values from **Product identity**:

- Package/Identity/Name
- Publisher
- Publisher display name

The Package/Identity/Publisher value must match the MSIX manifest exactly.

## Build locally

First build the release executable:

```powershell
npm ci
npm run tauri:build -- --no-bundle
```

Then create the unsigned Store package:

```powershell
.\scripts\build-store-msix.ps1 `
  -PackageIdentityName "<Package/Identity/Name>" `
  -Publisher "<Publisher>" `
  -PublisherDisplayName "<Publisher display name>" `
  -Version "0.1.0.0" `
  -OutputPath "artifacts\store\Nimbi-store.msix"
```

The unsigned package is intended for Microsoft Store submission. Do not distribute it directly as a production installer.

## GitHub Actions

Run **Store MSIX** manually and enter the three Partner Center identity values plus the four-part MSIX version. The workflow uploads `nimbi-store-msix`.

Pull requests run the same packaging path with development-only manifest values so that MakeAppx/schema regressions fail before release.

## Smart App Control

Do not disable Smart App Control to test Nimbi. The Store-signed package is the production trust path for this project.
