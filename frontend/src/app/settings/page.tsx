export default function SettingsPage() {
  return (
    <div className="p-8">
      <h1 className="text-[1.5rem] font-bold text-slate-deep mb-2">Settings</h1>
      <p className="text-sm text-outline mb-8">System configuration and preferences</p>

      <div className="max-w-2xl space-y-6">
        {/* API Configuration */}
        <div className="bg-white p-6">
          <h2 className="text-[0.7rem] uppercase tracking-[0.15em] text-outline font-bold mb-4">
            API Configuration
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-deep block mb-1">
                Backend URL
              </label>
              <input
                type="text"
                defaultValue="http://localhost:8000"
                disabled
                className="w-full bg-surface-low text-sm text-slate-deep px-3 py-2.5 border-b-2 border-outline/20 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white p-6">
          <h2 className="text-[0.7rem] uppercase tracking-[0.15em] text-outline font-bold mb-4">
            Notification Preferences
          </h2>
          <div className="space-y-3">
            {["New high-confidence signals", "Bid closing reminders", "Pipeline failures"].map((item) => (
              <label key={item} className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-deep">{item}</span>
                <div className="w-10 h-5 bg-surface-high relative">
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-outline transition-transform" />
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
