Pod::Spec.new do |s|
  s.name           = 'Pose'
  s.version        = '1.0.0'
  s.summary        = 'Where the system puts its bars and where the fold divides the screen'
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
