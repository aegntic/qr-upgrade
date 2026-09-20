declare module "qrcode/lib/core/qrcode" {
  const QRCode: {
    create(
      text: string,
      options: { errorCorrectionLevel: "H" },
    ): {
      modules: { size: number; data: Uint8Array; reservedBit: Uint8Array };
    };
  };
  export default QRCode;
}
