Pod::Spec.new do |s|
  s.name           = 'ValhallaRoute'
  s.version        = '1.0.0'
  s.summary        = 'Valhalla routing bridge'
  s.description    = 'Expo module that wraps valhalla-mobile'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  # valhalla-mobile is a Swift Package: React Native's spm_dependency adds it to the pod.
  spm_dependency(s,
    url: 'https://github.com/Rallista/valhalla-mobile',
    requirement: { kind: 'exactVersion', version: '0.6.4' },
    products: ['Valhalla']
  )

  s.source_files = "*.{h,m,mm,swift,hpp,cpp}"
end
