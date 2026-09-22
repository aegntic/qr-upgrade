# Dependency license review — engineering inventory

20 September2026. Not legal approval or a guarantee of license compatibility. Inventories are the installed npm dependency graph in the private preflight SBOMs; regenerate them with the final release and retain the lockfile fingerprints.

Web inventory:103components. Mobile npm inventory:583components. The single absent web SBOM declaration was rgbcolor1.0.1: its package manifest uses a nonstandard license expression, but its shipped LICENSE.md expressly offers the MIT alternative. The file hash and inventory counts are retained in `compliance/evidence/provider-setup/license-triage.json`.

Review the shipped notices/source obligations of LGPL-licensed server libvips and MPL-licensed LightningCSS packages. DOMPurify offers MPL or Apache2.0; node-forge offers BSD3-Clause or GPL2.0. These alternative-license expressions are not evidence that every alternative must be applied simultaneously. Keep actual notices for the selected permissible alternative. Do not remove or rewrite third-party license files in installed dependencies.

The npm SBOM is not an inventory of the final APK/IPA's Gradle, CocoaPods, binary codecs, fonts, trademarks or creative assets. Native artifact dependency inventory and distribution notices must be checked separately before store release. The existing Alex Martynov glass-icon credit/license and brand artwork use review are separate from code-package licenses.

The operator and independent approver still need to record the selected license basis, any required distribution/source notices, responsibility for patch triage and alert delivery, and acceptance of any unresolved license issue. No license gate is marked approved by this triage.
