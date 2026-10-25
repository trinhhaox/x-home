import Foundation

/// Checks for published releases on GitHub and compares semantic versions.
public enum AppUpdater {
    public static let repoOwner = "trinhhaox"
    public static let repoName = "x-home"
    public static let releasesURL = URL(string: "https://github.com/\(repoOwner)/\(repoName)/releases")!
    public static let latestReleaseAPI = URL(string: "https://api.github.com/repos/\(repoOwner)/\(repoName)/releases/latest")!

    public struct Release: Codable, Sendable, Equatable {
        public let tagName: String
        public let title: String
        public let notes: String
        public let releaseURL: URL
        public let publishedAt: String?
        public let dmgURL: URL?
        public let dmgSize: Int?

        public var version: String {
            cleanVersion(tagName)
        }

        public init(
            tagName: String,
            title: String,
            notes: String,
            releaseURL: URL,
            publishedAt: String? = nil,
            dmgURL: URL? = nil,
            dmgSize: Int? = nil
        ) {
            self.tagName = tagName
            self.title = title
            self.notes = notes
            self.releaseURL = releaseURL
            self.publishedAt = publishedAt
            self.dmgURL = dmgURL
            self.dmgSize = dmgSize
        }
    }

    /// Strips leading 'v' or 'V' and trims whitespace.
    public static func cleanVersion(_ raw: String) -> String {
        var str = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if str.lowercased().hasPrefix("v") {
            str = String(str.dropFirst())
        }
        return str
    }

    /// Compares two semver version strings (e.g. "1.0.2" vs "1.0.1").
    /// Returns true if `candidate` is strictly greater than `current`.
    public static func isVersion(_ candidate: String, newerThan current: String) -> Bool {
        let v1 = cleanVersion(candidate).split(separator: ".").compactMap { Int($0.prefix { $0.isNumber }) }
        let v2 = cleanVersion(current).split(separator: ".").compactMap { Int($0.prefix { $0.isNumber }) }

        let count = max(v1.count, v2.count)
        for i in 0..<count {
            let part1 = i < v1.count ? v1[i] : 0
            let part2 = i < v2.count ? v2[i] : 0
            if part1 > part2 { return true }
            if part1 < part2 { return false }
        }
        return false
    }

    private struct GitHubReleasePayload: Decodable {
        let tagName: String
        let name: String?
        let body: String?
        let htmlUrl: String
        let publishedAt: String?
        let draft: Bool?
        let prerelease: Bool?
        let assets: [GitHubAssetPayload]?

        enum CodingKeys: String, CodingKey {
            case tagName = "tag_name"
            case name
            case body
            case htmlUrl = "html_url"
            case publishedAt = "published_at"
            case draft
            case prerelease
            case assets
        }
    }

    private struct GitHubAssetPayload: Decodable {
        let name: String
        let browserDownloadUrl: String
        let size: Int?

        enum CodingKeys: String, CodingKey {
            case name
            case browserDownloadUrl = "browser_download_url"
            case size
        }
    }

    /// Queries GitHub for the latest release. Returns a Release if a newer version is found.
    public static func checkLatestRelease(
        currentVersion: String,
        session: URLSession = .shared
    ) async throws -> Release? {
        var request = URLRequest(url: latestReleaseAPI)
        request.setValue("application/vnd.github.v3+json", forHTTPHeaderField: "Accept")
        request.setValue("Xhome-App", forHTTPHeaderField: "User-Agent")
        request.timeoutInterval = 15

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        guard http.statusCode == 200 else {
            if http.statusCode == 404 { return nil } // No releases published yet
            throw URLError(.init(rawValue: http.statusCode))
        }

        let payload = try JSONDecoder().decode(GitHubReleasePayload.self, from: data)
        guard payload.draft != true else { return nil }

        let candidateVersion = cleanVersion(payload.tagName)
        guard isVersion(candidateVersion, newerThan: currentVersion) else {
            return nil
        }

        // Look for the macOS .dmg asset
        let dmgAsset = payload.assets?.first(where: { $0.name.hasSuffix(".dmg") })
        let dmgURL = dmgAsset.flatMap { URL(string: $0.browserDownloadUrl) }
        let releaseURL = URL(string: payload.htmlUrl) ?? releasesURL

        return Release(
            tagName: payload.tagName,
            title: payload.name ?? "Xhome \(candidateVersion)",
            notes: payload.body ?? "",
            releaseURL: releaseURL,
            publishedAt: payload.publishedAt,
            dmgURL: dmgURL,
            dmgSize: dmgAsset?.size
        )
    }
}
