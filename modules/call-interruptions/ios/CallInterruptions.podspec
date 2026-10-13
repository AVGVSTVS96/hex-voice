Pod::Spec.new do |s|
  s.name           = 'CallInterruptions'
  s.version        = '1.0.0'
  s.summary        = 'When a phone call or Siri takes the call audio, and when it comes back'
  s.author         = ''
  s.homepage       = 'https://github.com/AVGVSTVS96/hex-voice'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
