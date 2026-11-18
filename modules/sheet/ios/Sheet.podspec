Pod::Spec.new do |s|
  s.name           = 'Sheet'
  s.version        = '1.0.0'
  s.summary        = 'Sheets as wide as their window, not a card in the middle of a wide screen'
  s.author         = ''
  s.homepage       = 'https://github.com/AVGVSTVS96/hex-voice'
  s.license        = 'MIT'
  s.platforms      = { :ios => '18.0' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'ExpoUI'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
