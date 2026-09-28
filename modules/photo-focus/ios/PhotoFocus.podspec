Pod::Spec.new do |s|
  s.name           = 'PhotoFocus'
  s.version        = '1.0.0'
  s.summary        = "Finds a photo's Focal point with Apple Vision (ADR-0010)"
  s.author         = ''
  s.homepage       = 'https://github.com/gariasf/green-friends'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.swift'
end
