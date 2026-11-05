Pod::Spec.new do |s|
  s.name           = 'Markdown'
  s.version        = '1.0.0'
  s.summary        = 'Markdown drawn by Textual inside the SwiftUI tree Expo UI builds'
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
  spm_dependency(s,
    url: 'https://github.com/gonzalezreal/textual',
    requirement: { kind: 'exactVersion', version: '0.5.0' },
    products: ['Textual']
  )
end
