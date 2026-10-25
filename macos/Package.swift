// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "Xhome",
    platforms: [.macOS(.v13)],
    dependencies: [
        .package(path: "../core")
    ],
    targets: [
        .executableTarget(name: "Xhome",
                          dependencies: [.product(name: "HouseCore", package: "core"),
                                         .product(name: "HouseSmartLife", package: "core")],
                          path: "Sources/Xhome")
    ]
)
