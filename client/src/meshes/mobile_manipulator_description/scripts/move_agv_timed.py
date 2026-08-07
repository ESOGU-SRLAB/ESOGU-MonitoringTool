#!/usr/bin/env python3

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
import time
import sys

class TimedAGVMover(Node):
    def __init__(self):
        super().__init__('timed_agv_mover')
        self.publisher = self.create_publisher(
            Twist, 
            '/kawasaki/ota_base_controller/cmd_vel_unstamped', 
            10
        )
        # Publisher'ın hazır olması için kısa bir bekleme
        time.sleep(0.5)
        
    def move_for_duration(self, linear_x, angular_z, duration):
        """
        AGV'yi belirtilen süre boyunca hareket ettirir ve sonra durdurur.
        
        Args:
            linear_x: İleri/geri hız (m/s)
            angular_z: Dönüş hızı (rad/s)
            duration: Hareket süresi (saniye)
        """
        # Hareket komutu
        twist = Twist()
        twist.linear.x = linear_x
        twist.angular.z = angular_z
        
        start_time = time.time()
        rate_hz = 20  # 20 Hz - daha sık komut gönder
        sleep_time = 1.0 / rate_hz
        
        self.get_logger().info(f'AGV {duration} saniye boyunca hareket ediyor...')
        
        # Belirtilen süre boyunca hareket komutları gönder
        while time.time() - start_time < duration:
            self.publisher.publish(twist)
            time.sleep(sleep_time)
        
        # Durdur komutu gönder
        stop_twist = Twist()
        stop_twist.linear.x = 0.0
        stop_twist.angular.z = 0.0
        
        self.get_logger().info('AGV duruyor...')
        
        # Durduğundan emin olmak için 1 saniye boyunca stop komutu gönder
        stop_start = time.time()
        while time.time() - stop_start < 1.0:
            self.publisher.publish(stop_twist)
            time.sleep(sleep_time)
        
        self.get_logger().info('AGV durdu.')

def main(args=None):
    rclpy.init(args=args)
    node = TimedAGVMover()
    
    try:
        # Komut satırı argümanlarını kontrol et
        if len(sys.argv) > 1:
            duration = float(sys.argv[1])
        else:
            duration = 1.0
            
        if len(sys.argv) > 2:
            linear_x = float(sys.argv[2])
        else:
            linear_x = 0.1
            
        if len(sys.argv) > 3:
            angular_z = float(sys.argv[3])
        else:
            angular_z = 0.0
        
        # Hareket ettir
        node.move_for_duration(linear_x=linear_x, angular_z=angular_z, duration=duration)
        
    except KeyboardInterrupt:
        pass
    except Exception as e:
        node.get_logger().error(f'Hata: {e}')
    finally:
        # Emin olmak için son stop komutları
        stop_twist = Twist()
        for _ in range(20):
            node.publisher.publish(stop_twist)
            time.sleep(0.05)
        
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
