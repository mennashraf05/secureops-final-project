import { Box, Shield, Network } from 'lucide-react';
export function Logo({ dark=true }: { dark?: boolean }) {
  return <div className="flex items-center gap-3">
    <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 text-white shadow-glow">
      <Shield size={25}/><Box className="absolute bottom-2 right-2" size={13}/><Network className="absolute left-2 top-2 opacity-70" size={12}/>
    </div>
    <div><p className={`text-xl font-extrabold ${dark ? 'text-white' : 'text-slate-950'}`}>SecureOps</p><p className={`text-xs font-semibold ${dark ? 'text-cyan-300' : 'text-slate-500'}`}>Inventory & Risk Platform</p></div>
  </div>;
}
