Pod::Spec.new do |s|
  s.name           = 'Pages'
  s.version        = '1.0.0'
  s.summary        = "Tasks' pages, one or two side by side, laid out by SwiftUI from the width it's given"
  s.author         = ''
  s.homepage       = 'https://github.com/AVGVSTVS96/hex-voice'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'ExpoUI'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
