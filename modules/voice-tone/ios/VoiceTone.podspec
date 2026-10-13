Pod::Spec.new do |s|
  s.name           = 'VoiceTone'
  s.version        = '1.0.0'
  s.summary        = 'The pitch and tone of your voice during a call, read from WebRTC microphone audio'
  s.author         = ''
  s.homepage       = 'https://github.com/AVGVSTVS96/hex-voice'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,c,swift}'
end
