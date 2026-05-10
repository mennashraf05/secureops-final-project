import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

type AuthenticatorQrCodeProps = {
  uri: string;
};

export function AuthenticatorQrCode({ uri }: AuthenticatorQrCodeProps) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let isMounted = true;

    if (!uri) {
      setDataUrl('');
      return;
    }

    QRCode.toDataURL(uri, {
      width: 192,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((nextDataUrl) => {
        if (isMounted) setDataUrl(nextDataUrl);
      })
      .catch(() => {
        if (isMounted) setDataUrl('');
      });

    return () => {
      isMounted = false;
    };
  }, [uri]);

  if (!dataUrl) {
    return <div className="grid h-48 w-48 place-items-center rounded-2xl bg-white text-sm font-semibold text-slate-500">Loading QR...</div>;
  }

  return (
    <div className="inline-flex rounded-2xl bg-white p-3 shadow-card ring-1 ring-slate-200">
      <img className="h-48 w-48" src={dataUrl} alt="Authenticator setup QR code" />
    </div>
  );
}
