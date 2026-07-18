'use client';

/**
 * EmergencyPanel — tabbed interface for emergency services:
 * SOS alert, Medical triage, Lost Child protocol, and AED locator.
 *
 * Requirements: 15.1–15.8, 16.1–16.3
 */

import { useState, useCallback } from 'react';
import { useFanStore } from '@/stores/fan-store';
import { useFacilityStore } from '@/stores/facility-store';
import { useStadiumStore } from '@/stores/stadium-store';
import { useCrowdStore } from '@/stores/crowd-store';
import { getMedicalTriage } from '@/services/genai-client';
import { computeSOSRoute } from '@/engine/route-engine';
import type { TriageResponse } from '@/types/emergency';
import type { RouteResult } from '@/types/route';
import type { Facility } from '@/types/facility';

type EmergencyTab = 'sos' | 'medical' | 'lost_child' | 'aed';

export function EmergencyPanel() {
  const [activeTab, setActiveTab] = useState<EmergencyTab>('sos');

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Emergency</h2>

      {/* Category Tabs */}
      <nav aria-label="Emergency categories">
        <div role="tablist" className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <TabButton
            id="emergency-tab-sos"
            label="SOS"
            isActive={activeTab === 'sos'}
            panelId="emergency-panel-sos"
            onClick={() => setActiveTab('sos')}
          />
          <TabButton
            id="emergency-tab-medical"
            label="Medical"
            isActive={activeTab === 'medical'}
            panelId="emergency-panel-medical"
            onClick={() => setActiveTab('medical')}
          />
          <TabButton
            id="emergency-tab-lost-child"
            label="Lost Child"
            isActive={activeTab === 'lost_child'}
            panelId="emergency-panel-lost-child"
            onClick={() => setActiveTab('lost_child')}
          />
          <TabButton
            id="emergency-tab-aed"
            label="AED"
            isActive={activeTab === 'aed'}
            panelId="emergency-panel-aed"
            onClick={() => setActiveTab('aed')}
          />
        </div>
      </nav>

      {/* Tab Panels */}
      {activeTab === 'sos' && <SOSPanel />}
      {activeTab === 'medical' && <MedicalPanel />}
      {activeTab === 'lost_child' && <LostChildPanel />}
      {activeTab === 'aed' && <AEDPanel />}
    </div>
  );
}

// === SOS Panel ===

function SOSPanel() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [sosType, setSosType] = useState<'medical' | 'security' | 'general'>('general');
  const currentZone = useFanStore((s) => s.profile.currentZone);

  const sendSOS = useCallback(async () => {
    if (!currentZone) return;
    setStatus('sending');

    const payload = {
      id: crypto.randomUUID(),
      zone: currentZone,
      timestamp: Date.now(),
      type: sosType,
    };

    // Retry with exponential backoff: 1s, 2s, 4s
    let attempt = 0;
    const maxRetries = 3;

    while (attempt < maxRetries) {
      try {
        const response = await fetch('/api/sos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          setStatus('sent');
          return;
        }
      } catch {
        // Network error, will retry
      }
      attempt++;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }

    // All retries exhausted — show zone fallback
    setStatus('failed');
  }, [currentZone, sosType]);

  return (
    <div
      id="emergency-panel-sos"
      role="tabpanel"
      aria-labelledby="emergency-tab-sos"
      className="space-y-4"
    >
      {/* SOS Type selector */}
      <div>
        <label htmlFor="sos-type" className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Alert Type
        </label>
        <select
          id="sos-type"
          value={sosType}
          onChange={(e) => setSosType(e.target.value as 'medical' | 'security' | 'general')}
          className="mt-1 block w-full text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground px-2 py-1.5"
        >
          <option value="general">General Emergency</option>
          <option value="medical">Medical Emergency</option>
          <option value="security">Security Issue</option>
        </select>
      </div>

      {/* SOS Button */}
      <button
        type="button"
        onClick={sendSOS}
        disabled={!currentZone || status === 'sending'}
        aria-label="Send SOS alert"
        className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-xl font-bold transition-colors focus:outline-2 focus:outline-red-600 focus:outline-offset-2"
      >
        {status === 'sending' ? 'Sending...' : 'SOS'}
      </button>

      {!currentZone && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Set your current zone to enable SOS alerts.
        </p>
      )}

      {status === 'sent' && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700">
          <p className="text-sm text-green-700 dark:text-green-400 font-medium">
            SOS alert sent successfully.
          </p>
          <p className="text-xs text-green-600 dark:text-green-500 mt-1">
            Help is on the way. Stay in your current location.
          </p>
        </div>
      )}

      {status === 'failed' && (
        <div
          className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700"
          role="alert"
        >
          <p className="text-sm text-red-700 dark:text-red-400 font-medium">
            SOS transmission failed. Please tell nearby staff your location:
          </p>
          <p className="text-lg font-bold text-red-800 dark:text-red-300 mt-2 text-center">
            {currentZone}
          </p>
          <button
            type="button"
            onClick={sendSOS}
            className="mt-2 w-full py-2 rounded bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

// === Medical Panel ===

function MedicalPanel() {
  const [symptoms, setSymptoms] = useState('');
  const [triageResult, setTriageResult] = useState<TriageResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const currentZone = useFanStore((s) => s.profile.currentZone);
  const language = useFanStore((s) => s.profile.language);
  const facilities = useFacilityStore((s) => s.facilities);

  const medicalFacilities = facilities.filter(
    (f) => f.type === 'first_aid' || f.type === 'medical_center'
  );

  const handleTriage = useCallback(async () => {
    if (!symptoms.trim() || !currentZone) return;
    setLoading(true);

    const availableFacilities = medicalFacilities.map((f) => ({
      id: f.id,
      type: f.type,
      zone: f.zone,
      name: f.name,
    }));

    const result = await getMedicalTriage({
      symptoms: symptoms.trim(),
      currentZone,
      availableFacilities,
      language,
    });

    setTriageResult(result);
    setLoading(false);
  }, [symptoms, currentZone, medicalFacilities, language]);

  return (
    <div
      id="emergency-panel-medical"
      role="tabpanel"
      aria-labelledby="emergency-tab-medical"
      className="space-y-4"
    >
      {/* Medical Facilities List */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">Medical Facilities</h3>
        {medicalFacilities.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No medical facilities available.</p>
        ) : (
          <ul className="space-y-2" aria-label="Medical facilities">
            {medicalFacilities.map((f) => (
              <MedicalFacilityCard key={f.id} facility={f} />
            ))}
          </ul>
        )}
      </div>

      {/* Triage Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h3 className="text-sm font-medium text-foreground mb-2">Symptom Triage</h3>
        <div className="space-y-2">
          <label htmlFor="symptom-input" className="sr-only">
            Describe your symptoms
          </label>
          <textarea
            id="symptom-input"
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="Describe your symptoms..."
            rows={3}
            className="block w-full text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground px-3 py-2 resize-none"
          />
          <button
            type="button"
            onClick={handleTriage}
            disabled={!symptoms.trim() || !currentZone || loading}
            className="w-full py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium transition-colors"
          >
            {loading ? 'Analyzing...' : 'Get Triage Guidance'}
          </button>
          {!currentZone && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Set your current zone to get location-aware triage guidance.
            </p>
          )}
        </div>
      </div>

      {/* Triage Result */}
      {triageResult && (
        <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-2">
          <div className="flex items-center gap-2">
            <UrgencyBadge urgency={triageResult.urgency} />
            <span className="text-sm font-medium text-foreground">
              Recommendation: {formatRecommendation(triageResult.recommendation)}
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {triageResult.reasoning}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">
            {triageResult.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}

// === Lost Child Panel ===

function LostChildPanel() {
  const [childAge, setChildAge] = useState('');
  const [clothing, setClothing] = useState('');
  const [lastKnownZone, setLastKnownZone] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentZone = useFanStore((s) => s.profile.currentZone);
  const graph = useStadiumStore((s) => s.graph);
  const zones = graph?.zones ?? [];

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    const age = Number(childAge);
    if (!childAge || isNaN(age) || age < 0 || age > 17) {
      newErrors.age = 'Age must be between 0 and 17';
    }
    if (clothing.trim().length < 5) {
      newErrors.clothing = 'Please provide at least 5 characters describing clothing';
    }
    if (!lastKnownZone) {
      newErrors.zone = 'Please select the last known zone';
    }
    if (contactInfo.trim().length < 3) {
      newErrors.contact = 'Please provide valid contact information';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    if (!currentZone) return;
    setStatus('sending');

    const payload = {
      id: crypto.randomUUID(),
      childAge: Number(childAge),
      childDescription: clothing.trim(),
      lastKnownZone,
      timestamp: Date.now(),
      contactInfo: contactInfo.trim(),
      reporterZone: currentZone,
    };

    // Retry with exponential backoff
    let attempt = 0;
    const maxRetries = 3;

    while (attempt < maxRetries) {
      try {
        const response = await fetch('/api/sos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'lost_child', ...payload }),
        });
        if (response.ok) {
          setStatus('sent');
          return;
        }
      } catch {
        // Network error, will retry
      }
      attempt++;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }

    setStatus('failed');
  }, [childAge, clothing, lastKnownZone, contactInfo, currentZone]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      id="emergency-panel-lost-child"
      role="tabpanel"
      aria-labelledby="emergency-tab-lost-child"
      className="space-y-4"
    >
      <div className="space-y-3">
        <div>
          <label htmlFor="child-age" className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Child Age
          </label>
          <input
            id="child-age"
            type="number"
            min={0}
            max={17}
            value={childAge}
            onChange={(e) => setChildAge(e.target.value)}
            placeholder="Age"
            className="mt-1 block w-full text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground px-2 py-1.5"
          />
          {errors.age && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.age}</p>
          )}
        </div>

        <div>
          <label htmlFor="child-clothing" className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Clothing Description
          </label>
          <textarea
            id="child-clothing"
            value={clothing}
            onChange={(e) => setClothing(e.target.value)}
            placeholder="Describe what the child is wearing..."
            rows={2}
            className="mt-1 block w-full text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground px-3 py-2 resize-none"
          />
          {errors.clothing && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.clothing}</p>
          )}
        </div>

        <div>
          <label htmlFor="last-known-zone" className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Last Known Zone
          </label>
          <select
            id="last-known-zone"
            value={lastKnownZone}
            onChange={(e) => setLastKnownZone(e.target.value)}
            className="mt-1 block w-full text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground px-2 py-1.5"
          >
            <option value="">Select zone...</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          {errors.zone && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.zone}</p>
          )}
        </div>

        <div>
          <label htmlFor="contact-info" className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Contact Info
          </label>
          <input
            id="contact-info"
            type="text"
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            placeholder="Phone number or name"
            className="mt-1 block w-full text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground px-2 py-1.5"
          />
          {errors.contact && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.contact}</p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!currentZone || status === 'sending'}
          className="w-full py-2 rounded bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white text-sm font-medium transition-colors"
        >
          {status === 'sending' ? 'Submitting...' : 'Report Lost Child'}
        </button>

        {!currentZone && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Set your current zone to report a lost child.
          </p>
        )}
      </div>

      {status === 'sent' && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700">
          <p className="text-sm text-green-700 dark:text-green-400 font-medium">
            Lost child alert submitted to stadium security.
          </p>
          <div className="mt-2 text-xs text-green-600 dark:text-green-500 space-y-1">
            <p>1. Remain in your current location.</p>
            <p>2. Contact the nearest staff member.</p>
            <p>3. Security will begin a search immediately.</p>
          </div>
        </div>
      )}

      {status === 'failed' && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700" role="alert">
          <p className="text-sm text-red-700 dark:text-red-400 font-medium">
            Submission failed. Please report to the nearest staff member directly.
          </p>
          <p className="text-xs text-red-600 dark:text-red-500 mt-1">
            Your location: <strong>{currentZone}</strong>
          </p>
        </div>
      )}
    </div>
  );
}

// === AED Panel ===

function AEDPanel() {
  const [aedRoute, setAedRoute] = useState<RouteResult | null>(null);
  const [selectedAed, setSelectedAed] = useState<string | null>(null);

  const currentZone = useFanStore((s) => s.profile.currentZone);
  const facilities = useFacilityStore((s) => s.facilities);
  const graph = useStadiumStore((s) => s.graph);
  const densityMap = useCrowdStore((s) => s.densityMap);

  const aedStations = facilities.filter((f) => f.type === 'AED_station');

  const handleRouteToAed = useCallback(
    (facility: Facility) => {
      if (!currentZone || !graph) return;

      const result = computeSOSRoute(
        graph,
        currentZone,
        facility.zone,
        densityMap
      );

      setAedRoute(result);
      setSelectedAed(facility.id);
    },
    [currentZone, graph, densityMap]
  );

  return (
    <div
      id="emergency-panel-aed"
      role="tabpanel"
      aria-labelledby="emergency-tab-aed"
      className="space-y-4"
    >
      <h3 className="text-sm font-medium text-foreground">AED (Defibrillator) Stations</h3>

      {aedStations.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No AED stations available.</p>
      ) : (
        <ul className="space-y-2" aria-label="AED stations">
          {aedStations.map((aed) => (
            <li
              key={aed.id}
              className={`p-3 rounded-lg border transition-colors ${
                selectedAed === aed.id
                  ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{aed.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Zone: {aed.zone} · Status: {aed.status}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRouteToAed(aed)}
                  disabled={!currentZone}
                  className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium transition-colors"
                >
                  Route
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!currentZone && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Set your current zone to compute routes to AED stations.
        </p>
      )}

      {/* Route display */}
      {aedRoute && aedRoute.status === 'found' && (
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
          <p className="text-sm font-medium text-foreground">Route to AED</p>
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <p>Distance: {aedRoute.distance}m</p>
            <p>Estimated time: {Math.round(aedRoute.estimatedTime / 60)} min</p>
            <p>Path: {aedRoute.path.join(' → ')}</p>
          </div>
        </div>
      )}

      {aedRoute && aedRoute.status === 'not_found' && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700" role="alert">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            No route found to this AED station.
            {aedRoute.nearestReachable && (
              <span> Nearest reachable zone: {aedRoute.nearestReachable}</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// === Helper Components ===

function TabButton({
  id,
  label,
  isActive,
  panelId,
  onClick,
}: {
  id: string;
  label: string;
  isActive: boolean;
  panelId: string;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      role="tab"
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      onClick={onClick}
      className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus:outline-2 focus:outline-blue-600 focus:outline-offset-[-2px] ${
        isActive
          ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
    >
      {label}
    </button>
  );
}

function MedicalFacilityCard({ facility }: { facility: Facility }) {
  const isMedicalCenter = facility.type === 'medical_center';

  return (
    <li className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{facility.name}</span>
            <span
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                isMedicalCenter
                  ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                  : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
              }`}
            >
              {isMedicalCenter ? 'Medical Center' : 'First Aid'}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Zone: {facility.zone} · Queue: {facility.queueEstimate} min
          </p>
        </div>
      </div>
    </li>
  );
}

function UrgencyBadge({ urgency }: { urgency: 'low' | 'medium' | 'high' }) {
  const styles = {
    low: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
    medium: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400',
    high: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
  };

  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${styles[urgency]}`}>
      {urgency}
    </span>
  );
}

function formatRecommendation(rec: TriageResponse['recommendation']): string {
  switch (rec) {
    case 'water_station':
      return 'Visit a Water Station';
    case 'first_aid':
      return 'Visit First Aid';
    case 'medical_center':
      return 'Go to Medical Center';
    default:
      return rec;
  }
}
