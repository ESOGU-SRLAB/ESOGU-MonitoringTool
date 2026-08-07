#!/usr/bin/env python3

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from nav_msgs.msg import Odometry
import math
import sys

class AGVPositionController(Node):
    def __init__(self):
        super().__init__('agv_position_controller')
        
        # Publisher ve Subscriber
        self.cmd_vel_pub = self.create_publisher(
            Twist, 
            '/kawasaki/ota_base_controller/cmd_vel_unstamped', 
            10
        )
        
        self.odom_sub = self.create_subscription(
            Odometry,
            '/kawasaki/ota_base_controller/odom',
            self.odom_callback,
            10
        )
        
        # Mevcut konum ve yönelim
        self.current_x = 0.0
        self.current_y = 0.0
        self.current_yaw = 0.0
        self.odom_received = False
        
    def odom_callback(self, msg):
        """Odometry mesajından mevcut konumu al"""
        self.current_x = msg.pose.pose.position.x
        self.current_y = msg.pose.pose.position.y
        
        # Quaternion'dan yaw hesapla
        orientation = msg.pose.pose.orientation
        siny_cosp = 2 * (orientation.w * orientation.z + orientation.x * orientation.y)
        cosy_cosp = 1 - 2 * (orientation.y * orientation.y + orientation.z * orientation.z)
        self.current_yaw = math.atan2(siny_cosp, cosy_cosp)
        
        self.odom_received = True
        
    def get_distance_to_goal(self, goal_x, goal_y):
        """Hedefe olan mesafeyi hesapla"""
        dx = goal_x - self.current_x
        dy = goal_y - self.current_y
        return math.sqrt(dx*dx + dy*dy)
    
    def get_angle_to_goal(self, goal_x, goal_y):
        """Hedefe olan açıyı hesapla"""
        dx = goal_x - self.current_x
        dy = goal_y - self.current_y
        return math.atan2(dy, dx)
    
    def normalize_angle(self, angle):
        """Açıyı -pi ile pi arasına normalize et"""
        while angle > math.pi:
            angle -= 2 * math.pi
        while angle < -math.pi:
            angle += 2 * math.pi
        return angle
    
    def move_to_position(self, goal_x, goal_y, tolerance=0.1):
        """
        AGV'yi belirtilen konuma hareket ettirir.
        
        Args:
            goal_x: Hedef X koordinatı (metre)
            goal_y: Hedef Y koordinatı (metre)
            tolerance: Hedefe varış toleransı (metre)
        """
        # Odometry'nin gelmesini bekle
        self.get_logger().info('Odometry verisi bekleniyor...')
        while not self.odom_received:
            rclpy.spin_once(self, timeout_sec=0.1)
        
        start_x = self.current_x
        start_y = self.current_y
        self.get_logger().info(f'Başlangıç konumu: ({start_x:.2f}, {start_y:.2f})')
        self.get_logger().info(f'Hedef konum: ({goal_x:.2f}, {goal_y:.2f})')
        
        # Kontrol parametreleri
        linear_speed = 0.15  # m/s - biraz daha yavaş
        angular_speed = 0.4  # rad/s
        angle_tolerance = 0.15  # radyan
        
        twist = Twist()
        consecutive_goal_reached = 0  # Hedefe ulaşma sayacı
        required_consecutive = 5  # Kaç kez üst üste hedefe ulaşması gerekli
        
        loop_count = 0
        max_loops = 2000  # Güvenlik için maksimum iterasyon
        
        while rclpy.ok() and loop_count < max_loops:
            # Odometry'yi güncelle
            rclpy.spin_once(self, timeout_sec=0.05)
            
            distance = self.get_distance_to_goal(goal_x, goal_y)
            
            # Debug için
            loop_count += 1
            if loop_count % 20 == 0:
                self.get_logger().info(
                    f'Konum: ({self.current_x:.2f}, {self.current_y:.2f}), '
                    f'Mesafe: {distance:.3f}m, Tolerans: {tolerance}m'
                )
            
            # Hedefe ulaşıldı mı kontrol et
            if distance < tolerance:
                consecutive_goal_reached += 1
                self.get_logger().info(
                    f'Hedefe yakın! ({consecutive_goal_reached}/{required_consecutive}) '
                    f'Mesafe: {distance:.3f}m'
                )
                
                # Birkaç kez üst üste hedefe ulaşılınca dur
                if consecutive_goal_reached >= required_consecutive:
                    self.get_logger().info(
                        f'Hedefe ulaşıldı! Nihai konum: ({self.current_x:.2f}, {self.current_y:.2f})'
                    )
                    break
                    
                # Hedefe yakınken çok yavaş git
                twist.linear.x = 0.0
                twist.angular.z = 0.0
            else:
                consecutive_goal_reached = 0  # Sayacı sıfırla
                
                # Hedefe olan açıyı hesapla
                target_angle = self.get_angle_to_goal(goal_x, goal_y)
                angle_diff = self.normalize_angle(target_angle - self.current_yaw)
                
                # Önce dön, sonra ilerle stratejisi
                if abs(angle_diff) > angle_tolerance:
                    # Dönüş yap
                    twist.linear.x = 0.0
                    twist.angular.z = angular_speed if angle_diff > 0 else -angular_speed
                else:
                    # İlerle - mesafe azaldıkça yavaşla
                    speed_factor = min(1.0, distance / 0.5)  # 0.5m'den yakınsa yavaşla
                    twist.linear.x = linear_speed * speed_factor
                    twist.angular.z = 0.3 * angle_diff  # Küçük düzeltmeler
            
            self.cmd_vel_pub.publish(twist)
        
        if loop_count >= max_loops:
            self.get_logger().warn('Maksimum iterasyon sayısına ulaşıldı!')
        
        # Kesinlikle durdur
        self.get_logger().info('Durduruluyor...')
        stop_twist = Twist()
        stop_twist.linear.x = 0.0
        stop_twist.linear.y = 0.0
        stop_twist.linear.z = 0.0
        stop_twist.angular.x = 0.0
        stop_twist.angular.y = 0.0
        stop_twist.angular.z = 0.0
        
        for i in range(30):
            self.cmd_vel_pub.publish(stop_twist)
            rclpy.spin_once(self, timeout_sec=0.05)
        
        self.get_logger().info('Hareket tamamlandı ve robot durdu.')

def main(args=None):
    rclpy.init(args=args)
    node = AGVPositionController()
    
    try:
        if len(sys.argv) < 3:
            node.get_logger().error('Kullanım: move_agv_to_position.py <x> <y> [tolerance]')
            node.get_logger().info('Örnek: move_agv_to_position.py 2.0 1.5 0.1')
            return
        
        goal_x = float(sys.argv[1])
        goal_y = float(sys.argv[2])
        tolerance = float(sys.argv[3]) if len(sys.argv) > 3 else 0.1
        
        node.move_to_position(goal_x, goal_y, tolerance)
        
    except KeyboardInterrupt:
        node.get_logger().info('Kullanıcı tarafından durduruldu.')
    except Exception as e:
        node.get_logger().error(f'Hata: {e}')
    finally:
        # Kesinlikle durdur
        node.get_logger().info('Kapanıyor, son stop komutu gönderiliyor...')
        twist = Twist()
        twist.linear.x = 0.0
        twist.linear.y = 0.0
        twist.linear.z = 0.0
        twist.angular.x = 0.0
        twist.angular.y = 0.0
        twist.angular.z = 0.0
        
        for _ in range(30):
            node.cmd_vel_pub.publish(twist)
            rclpy.spin_once(node, timeout_sec=0.05)
        
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
