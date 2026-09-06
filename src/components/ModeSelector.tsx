import { COMPRESSION_PROFILES } from '../lib/compression/compressionConfig'
import type { CompressionMode } from '../lib/compression/compressionConfig'

type ModeSelectorProps = {
  selectedMode: CompressionMode
  onChange: (mode: CompressionMode) => void
  disabled?: boolean
}

export function ModeSelector({ selectedMode, onChange, disabled }: ModeSelectorProps) {
  // Use ordered array to ensure Low, Balanced, High order
  const orderedModes: CompressionMode[] = ['balanced', 'low', 'high'];

  return (
    <fieldset
      className="mode-selector mb-4"
      disabled={disabled}
      aria-disabled={disabled}
    >
      <legend className="sr-only">Compression mode</legend>
      <div className="flex flex-col space-y-2">
        {orderedModes.map((mode) => {
          const profile = COMPRESSION_PROFILES[mode]
          const isSelected = selectedMode === mode

          let displayLabel = profile.label;
          if (mode === 'balanced') displayLabel = 'Balanced';
          if (mode === 'low') displayLabel = 'Low';
          if (mode === 'high') displayLabel = 'High';

          let description = '';
          if (mode === 'balanced') description = 'Good compression, good quality';
          if (mode === 'low') description = 'Low compression, excellent quality';
          if (mode === 'high') description = 'High compression, average quality';


          return (
            <label
              key={mode}
              className={`flex items-start p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                isSelected
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center h-5">
                <input
                  type="radio"
                  name="compressionMode"
                  value={mode}
                  checked={isSelected}
                  onChange={() => onChange(mode)}
                  disabled={disabled}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
              </div>
              <div className="ml-3 flex-1">
                <span className={`block text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                  <span className="font-semibold">{displayLabel}</span> — {description}
                </span>
              </div>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
