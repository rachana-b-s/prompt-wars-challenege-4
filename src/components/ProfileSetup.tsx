'use client';

/**
 * ProfileSetup — Fan accessibility profile and allegiance configuration.
 * All changes immediately update the fan store (no save button needed).
 *
 * Sections:
 * 1. Accessibility needs (checkboxes for each category)
 * 2. Companion mode toggle
 * 3. Allergen input (comma-separated tags)
 * 4. Allegiance selector (radio buttons)
 * 5. Language preference selector
 *
 * Requirements: 3.22, 3.23, 5.1
 */

import { useFanStore } from '@/stores/fan-store';
import type { AccessibilityCategory, FanAllegiance, LanguageCode } from '@/types/fan';

/** Descriptive labels for each accessibility category */
const ACCESSIBILITY_OPTIONS: { value: AccessibilityCategory; label: string; description: string }[] = [
  { value: 'wheelchair', label: 'Wheelchair user', description: 'Requires step-free routes and accessible seating' },
  { value: 'limited_mobility', label: 'Limited mobility', description: 'Prefers shorter routes with rest areas' },
  { value: 'blind', label: 'Blind', description: 'Screen reader navigation with audio cues' },
  { value: 'low_vision', label: 'Low vision', description: 'High contrast and enlarged interface elements' },
  { value: 'deaf', label: 'Deaf', description: 'Visual-only navigation and haptic alerts' },
  { value: 'hard_of_hearing', label: 'Hard of hearing', description: 'Visual cues supplementing audio information' },
  { value: 'neurodivergent', label: 'Neurodivergent', description: 'Quiet routes with predictable step-by-step directions' },
  { value: 'pregnant', label: 'Pregnant', description: 'Routes near restrooms and rest areas' },
  { value: 'elderly', label: 'Elderly', description: 'Shorter distances with seating availability' },
  { value: 'child_accompanied', label: 'Accompanied by child', description: 'Family-friendly routes avoiding adult-only areas' },
];

const ALLEGIANCE_OPTIONS: { value: FanAllegiance; label: string }[] = [
  { value: 'home', label: 'Home team' },
  { value: 'away', label: 'Away team' },
  { value: 'neutral', label: 'Neutral' },
];

const LANGUAGE_OPTIONS: { value: LanguageCode; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'العربية' },
  { value: 'pt', label: 'Português' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
];

export function ProfileSetup() {
  const profile = useFanStore((s) => s.profile);
  const updateAccessibility = useFanStore((s) => s.updateAccessibility);
  const setAllegiance = useFanStore((s) => s.setAllegiance);
  const setLanguage = useFanStore((s) => s.setLanguage);

  const { accessibilityProfile, allegiance, language } = profile;

  /** Toggle an accessibility category on/off */
  function handleCategoryToggle(category: AccessibilityCategory) {
    const current = accessibilityProfile.categories;
    const updated = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
    updateAccessibility({ categories: updated });
  }

  /** Toggle companion mode */
  function handleCompanionToggle() {
    updateAccessibility({ hasCompanion: !accessibilityProfile.hasCompanion });
  }

  /** Handle allergen input — store as trimmed array */
  function handleAllergenChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const allergens = raw
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    updateAccessibility({ allergens });
  }

  return (
    <div className="p-4 space-y-6" role="form" aria-label="Profile setup">
      {/* Section: Accessibility Needs */}
      <fieldset>
        <legend className="text-base font-semibold text-foreground mb-2">
          Accessibility Needs
        </legend>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
          Select all that apply. You can update these at any time.
        </p>
        <div className="space-y-2">
          {ACCESSIBILITY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-start gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={accessibilityProfile.categories.includes(option.value)}
                onChange={() => handleCategoryToggle(option.value)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                aria-describedby={`desc-${option.value}`}
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  {option.label}
                </span>
                <span
                  id={`desc-${option.value}`}
                  className="text-xs text-gray-600 dark:text-gray-400"
                >
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Section: Companion Mode */}
      <fieldset>
        <legend className="text-base font-semibold text-foreground mb-2">
          Companion Mode
        </legend>
        <label className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
          <input
            type="checkbox"
            checked={accessibilityProfile.hasCompanion}
            onChange={handleCompanionToggle}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            aria-describedby="companion-desc"
          />
          <span className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              I have a companion
            </span>
            <span id="companion-desc" className="text-xs text-gray-600 dark:text-gray-400">
              A sighted or hearing companion who provides environmental guidance
            </span>
          </span>
        </label>
      </fieldset>

      {/* Section: Allergens */}
      <fieldset>
        <legend className="text-base font-semibold text-foreground mb-2">
          Allergens
        </legend>
        <label htmlFor="allergen-input" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
          Enter allergens separated by commas (e.g., nuts, dairy, gluten)
        </label>
        <input
          id="allergen-input"
          type="text"
          defaultValue={accessibilityProfile.allergens.join(', ')}
          onChange={handleAllergenChange}
          placeholder="nuts, dairy, gluten"
          className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          aria-describedby="allergen-hint"
        />
        <p id="allergen-hint" className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          Food stalls handling these allergens will be flagged with a warning.
        </p>
      </fieldset>

      {/* Section: Fan Allegiance */}
      <fieldset>
        <legend className="text-base font-semibold text-foreground mb-2">
          Fan Allegiance
        </legend>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          Routes will avoid opposing fan zones for your safety.
        </p>
        <div className="space-y-2">
          {ALLEGIANCE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            >
              <input
                type="radio"
                name="allegiance"
                value={option.value}
                checked={allegiance === option.value}
                onChange={() => setAllegiance(option.value)}
                className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              />
              <span className="text-sm font-medium text-foreground">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Section: Language Preference */}
      <fieldset>
        <legend className="text-base font-semibold text-foreground mb-2">
          Language
        </legend>
        <label htmlFor="language-select" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
          Navigation instructions and AI explanations will use this language.
        </label>
        <select
          id="language-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value as LanguageCode)}
          className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </fieldset>
    </div>
  );
}
