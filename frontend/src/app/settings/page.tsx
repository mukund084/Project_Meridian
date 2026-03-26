export default function SettingsPage() {
  return (
    <div className="p-8">
      <h1 className="text-[1.5rem] font-bold text-on-surface mb-2">Settings</h1>
      <p className="text-sm text-on-surface-variant mb-8">System configuration and preferences</p>
      <div className="max-w-2xl space-y-6">
        <div className="bg-white p-6 rounded-sm">
          <h2 className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-4">API Configuration</h2>
          <label className="text-xs font-bold uppercase tracking-wider text-on-surface block mb-1">Backend URL</label>
          <input type="text" defaultValue="http://localhost:8000" disabled className="w-full bg-surface-low text-sm text-on-surface px-3 py-2.5 rounded-sm outline-none" />
        </div>
        <div className="bg-white p-6 rounded-sm">
          <h2 className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-4">Notifications</h2>
          <div className="space-y-3">
            {["New high-confidence signals", "Bid closing reminders", "Contract expirations", "Pipeline failures"].map((item) => (
              <label key={item} className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-on-surface">{item}</span>
                <div className="w-10 h-5 bg-surface-high rounded-sm relative">
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-on-surface-variant rounded-sm transition-transform" />
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
