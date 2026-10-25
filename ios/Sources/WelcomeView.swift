import SwiftUI

/// Shown once, over the demo home that is already running behind it.
struct WelcomeView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(spacing: 0) {
            Image(systemName: "house.fill")
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(Color(red: 1, green: 0.95, blue: 0.86))
                .frame(width: 76, height: 76)
                .background(
                    LinearGradient(colors: [Color(red: 0.36, green: 0.24, blue: 0.52), Color(red: 0.13, green: 0.16, blue: 0.36), Color(red: 0.05, green: 0.07, blue: 0.16)],
                                   startPoint: .top, endPoint: .bottom),
                    in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                .shadow(color: Theme.warm.opacity(0.45), radius: 22)
                .padding(.top, 44)
                .accessibilityHidden(true)

            Text(loc("Welcome to Xhome", "Chào mừng đến với Xhome"))
                .font(.system(size: 27, weight: .bold))
                .foregroundStyle(Theme.text)
                .multilineTextAlignment(.center)
                .padding(.top, 20)
            Text(loc("Your home as a live 3D model, in your pocket.", "Ngôi nhà của bạn dưới dạng mô hình 3D trực quan, ngay trong túi."))
                .font(.system(size: 16))
                .foregroundStyle(Theme.muted)
                .multilineTextAlignment(.center)
                .padding(.top, 6)

            VStack(alignment: .leading, spacing: 26) {
                feature(
                    "hand.tap.fill",
                    Theme.warm,
                    loc("Tap a lamp, drag to dim", "Chạm vào đèn, kéo để chỉnh độ sáng"),
                    loc("Lights, colours, air conditioners and scenes, right on the floor plan.", "Đèn, màu sắc, máy điều hòa và kịch bản, ngay trên sơ đồ nhà.")
                )
                feature(
                    "pencil.and.ruler.fill",
                    Theme.accent,
                    loc("Draw it here or on your Mac", "Vẽ trên iPhone hoặc trên Mac"),
                    loc("Rooms, lamps and ACs, on this iPhone. Pair a Mac any time: both stay in sync.", "Phòng, đèn và điều hòa trên iPhone. Ghép đôi với Mac bất cứ lúc nào: cả hai luôn đồng bộ.")
                )
                feature(
                    "lightbulb.2.fill",
                    Theme.green,
                    loc("Your real devices", "Thiết bị thực tế của bạn"),
                    AppModel.includesSmartLife
                        ? loc(
                            "Smart Life, Home Assistant, Philips Hue and Apple Home. Until you connect one, everything is simulated.",
                            "Smart Life, Home Assistant, Philips Hue và Apple Home. Khi chưa kết nối, các thiết bị sẽ chạy ở chế độ mô phỏng."
                        )
                        : loc(
                            "Home Assistant, Philips Hue and Apple Home. Until you connect one, everything is simulated.",
                            "Home Assistant, Philips Hue và Apple Home. Khi chưa kết nối, các thiết bị sẽ chạy ở chế độ mô phỏng."
                        )
                )
            }
            .padding(.horizontal, 6)
            .frame(maxHeight: .infinity)

            Button { model.finishWelcome(.setUpHere) } label: { Label(loc("Set up my home", "Thiết lập nhà của tôi"), systemImage: "house.fill") }
                .buttonStyle(PrimaryButtonStyle())
            Button { model.finishWelcome(.pair) } label: { Label(loc("Pair with my Mac", "Ghép đôi với máy Mac"), systemImage: "laptopcomputer.and.iphone") }
                .buttonStyle(SecondaryButtonStyle())
                .padding(.top, 10)
            Button(loc("Explore the demo home", "Khám phá ngôi nhà mẫu")) { model.finishWelcome(.demo) }
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.muted)
                .frame(minHeight: 50)
                .padding(.top, 4)
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 10)
        .presentationDetents([.large])
        .presentationBackground(Theme.background)
        .presentationDragIndicator(.visible)
        .preferredColorScheme(.dark)
        .interactiveDismissDisabled(false)
        .onDisappear { UserDefaults.standard.set(true, forKey: "welcomed") }
    }

    private func feature(_ symbol: String, _ tint: Color, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 16) {
            IconBadge(symbol: symbol, tint: tint, size: 44)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.system(size: 17, weight: .semibold)).foregroundStyle(Theme.text)
                Text(detail)
                    .font(.system(size: 14.5))
                    .foregroundStyle(Theme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
