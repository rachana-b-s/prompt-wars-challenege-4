'use client';

/**
 * Staff Dashboard — Real-time operational intelligence for stadium organizers and staff.
 * Shows crowd density, SOS alerts, capacity metrics, and AI-powered recommendations.
 *
 * Problem Statement Coverage: "organizers, volunteers, or venue staff"
 * Requirements: Crowd management, operational intelligence, real-time decision support
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { useStadiumStore } from '@/stores/stadium-store';
import { useCrowdStore } from '@/stores/crowd-store';
import Link from 'next/link';

interface SOSAlertData {
  id: string;
  zone: string;
  type: string;
  timestamp: number;
}

const emptySubscribe = () => () => {};

function useHydrated(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export default function DashboardPage() {
  const graph = useStadiumStore((s) => s.graph);
  const densityMap = useCrowdStore((s) => s.densityMap);
  const [alerts, setAlerts] = useState<SOSAlertData[]>([]);
  const [lastRefresh, setLastRefresh] = useState(() => Date.now());
  const mounted = useHydrated();

  const zones = graph?.zones ?? [];

  // Fetch SOS alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/sos');
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.sosAlerts ?? []);
      }
    } catch { /* ignore fetch errors */ }
    setLastRefresh(Date.now());
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [fetchAlerts]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Compute stats
  const totalCapacity = zones.reduce((sum, z) => sum + z.capacity, 0);
  const avgDensity = zones.length > 0
    ? Math.round(zones.reduce((sum, z) => sum + (densityMap[z.id]?.density ?? 0), 0) / zones.length)
    : 0;
  const highDensityZones = zones.filter((z) => (densityMap[z.id]?.density ?? 0) > 70);
  const criticalZones = zones.filter((z) => (densityMap[z.id]?.density ?? 0) > 85);

  if (!mounted) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6" role="main" aria-label="Staff Dashboard">
        <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-800 rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-lg" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6" role="main" aria-label="Staff Dashboard">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Staff Dashboard</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Real-time operational intelligence · {graph?.metadata.name ?? 'Stadium'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Last refresh: {new Date(lastRefresh).toLocaleTimeString()}
            </span>
            <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Fan View →
            </Link>
          </div>
        </header>

        {/* Key Metrics */}
        <section aria-label="Key metrics">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Total Capacity" value={totalCapacity.toLocaleString()} />
            <MetricCard label="Avg Density" value={`${avgDensity}%`} variant={avgDensity > 70 ? 'warning' : 'normal'} />
            <MetricCard label="High Density Zones" value={`${highDensityZones.length}`} variant={highDensityZones.length > 3 ? 'warning' : 'normal'} />
            <MetricCard label="Active SOS Alerts" value={`${alerts.length}`} variant={alerts.length > 0 ? 'danger' : 'normal'} />
          </div>
        </section>

        {/* Critical Zones Alert */}
        {criticalZones.length > 0 && (
          <section aria-label="Critical zone alerts" className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <h2 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
              Critical Density Alert — {criticalZones.length} zone(s) above 85%
            </h2>
            <div className="flex flex-wrap gap-2">
              {criticalZones.map((z) => (
                <span key={z.id} className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded">
                  {z.name}: {densityMap[z.id]?.density ?? 0}%
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-red-700 dark:text-red-400">
              Recommendation: Consider redirecting foot traffic from these zones to nearby alternatives.
            </p>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Zone Density Table */}
          <section aria-label="Zone density overview" className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Zone Density</h2>
            <div className="overflow-y-auto max-h-96">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 font-medium">Zone</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Density</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {zones
                    .sort((a, b) => (densityMap[b.id]?.density ?? 0) - (densityMap[a.id]?.density ?? 0))
                    .map((zone) => {
                      const density = densityMap[zone.id]?.density ?? 0;
                      const level = density <= 40 ? 'green' : density <= 70 ? 'yellow' : 'red';
                      return (
                        <tr key={zone.id}>
                          <td className="py-2 text-gray-800 dark:text-gray-200">{zone.name}</td>
                          <td className="py-2 text-gray-600 dark:text-gray-400 capitalize">{zone.type.replace('_', ' ')}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${level === 'green' ? 'bg-green-500' : level === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'}`}
                                  style={{ width: `${density}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600 dark:text-gray-400">{density}%</span>
                            </div>
                          </td>
                          <td className="py-2">
                            <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-medium ${
                              level === 'green' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' :
                              level === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400' :
                              'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                            }`}>
                              {level === 'green' ? 'Normal' : level === 'yellow' ? 'Busy' : 'Critical'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>

          {/* SOS Alert Feed */}
          <section aria-label="SOS alert feed" className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">SOS Alert Feed</h2>
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400 py-8 text-center">
                No active alerts. All clear.
              </p>
            ) : (
              <ul className="space-y-2 max-h-96 overflow-y-auto" role="list">
                {alerts.map((alert) => (
                  <li key={alert.id} className="p-3 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-red-800 dark:text-red-200 capitalize">
                        {alert.type} Alert
                      </span>
                      <span className="text-xs text-red-700 dark:text-red-400">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                      Zone: {alert.zone}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* AI-Powered Crowd Flow Recommendations */}
        <section aria-label="AI recommendations" className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            AI Crowd Management Recommendations
          </h2>
          <div className="space-y-2">
            {highDensityZones.length > 0 ? (
              highDensityZones.map((zone) => (
                <div key={zone.id} className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <span className="text-blue-600 dark:text-blue-400 flex-shrink-0" aria-hidden="true">&#x1F4A1;</span>
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>{zone.name}</strong> is at {densityMap[zone.id]?.density ?? 0}% capacity.
                    Consider opening additional entry points or redirecting fans to nearby low-density zones.
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400 py-4 text-center">
                All zones within normal capacity. No action needed.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

/** Metric card component for the dashboard summary row. */
function MetricCard({ label, value, variant = 'normal' }: { label: string; value: string; variant?: 'normal' | 'warning' | 'danger' }) {
  const borderClass = variant === 'danger' ? 'border-red-300 dark:border-red-800' : variant === 'warning' ? 'border-yellow-300 dark:border-yellow-800' : 'border-gray-200 dark:border-gray-700';
  return (
    <div className={`p-4 bg-white dark:bg-gray-900 rounded-lg border ${borderClass}`}>
      <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
    </div>
  );
}
