Pod::Spec.new do |s|
  s.name           = 'Rows'
  s.version        = '1.0.0'
  s.summary        = "Tasks' rows laid out by SwiftUI from the width they're given"
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
